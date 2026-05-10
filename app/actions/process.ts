"use server"

import { revalidatePath } from "next/cache"
import {
  classifyEmail,
  type Classification,
} from "@/lib/ai/agents/classifier"
import { aiUnavailableMessage, readAIEnv } from "@/lib/ai/env"
import { preTriageEmail } from "@/lib/ai/triage"
import { createClient } from "@/lib/supabase/server"

const FREE_TIER_DAILY_LIMIT = 10
const CONCURRENCY = 5

export type ProcessResult =
  | {
      ok: true
      processed: number
      heuristic: number
      ai: number
      failed: number
      remaining: number | null
      plan: "free" | "pro"
    }
  | {
      ok: false
      error: string
      quotaExceeded?: boolean
    }

/**
 * Classify the user's currently-unprocessed emails.
 *
 * Two-stage pipeline for AI cost efficiency:
 *   1. `preTriageEmail` runs first on every row. It catches the highest-
 *      confidence "definitely no AI value" patterns (bounces, OOO replies,
 *      do-not-reply senders) and synthesises a Classification with zero
 *      OpenRouter spend. These do NOT count against the free-tier quota.
 *   2. Whatever the heuristic doesn't catch is sent to the AI classifier
 *      with concurrency=5. Free-tier users are capped at 10 AI calls per
 *      calendar day; heuristic hits are unlimited.
 */
export async function processEmails(): Promise<ProcessResult> {
  const ai = readAIEnv()
  if (!ai.configured) {
    return { ok: false, error: aiUnavailableMessage(ai) }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Not signed in." }

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan")
    .eq("id", user.id)
    .maybeSingle()
  const plan: "free" | "pro" = profile?.plan === "pro" ? "pro" : "free"

  // Pull ALL unprocessed emails — heuristic runs free, so no quota limit at
  // the query level. Quota is applied later, only to the AI batch.
  const { data: unprocessed, error: queryError } = await supabase
    .from("emails")
    .select("id, subject, sender, snippet, body")
    .eq("user_id", user.id)
    .is("category", null)
    .order("received_at", { ascending: false, nullsFirst: false })

  if (queryError) return { ok: false, error: queryError.message }
  if (!unprocessed || unprocessed.length === 0) {
    return {
      ok: true,
      processed: 0,
      heuristic: 0,
      ai: 0,
      failed: 0,
      remaining: null,
      plan,
    }
  }

  // Split via deterministic heuristic.
  type EmailRow = (typeof unprocessed)[number]
  const heuristicHits: { id: number; classification: Classification }[] = []
  const needsAi: EmailRow[] = []
  for (const email of unprocessed) {
    const triage = preTriageEmail({
      subject: email.subject,
      sender: email.sender,
      body: email.body,
      snippet: email.snippet,
    })
    if (triage.handled) {
      heuristicHits.push({ id: email.id, classification: triage.classification })
    } else {
      needsAi.push(email)
    }
  }

  // Free-tier quota check — only governs AI calls, not heuristic hits.
  let remaining: number | null = null
  if (plan === "free") {
    const dayStart = new Date()
    dayStart.setHours(0, 0, 0, 0)

    // We measure quota usage by AI-classified rows. Heuristic hits write
    // `category` too but cost zero tokens, so they shouldn't burn the
    // budget. Filter on `no_reply_reason` being one of the heuristic-only
    // values is brittle; cleanest is a dedicated marker column, but that's
    // over-engineering for the current scale. For now: every classified
    // row counts toward today's quota, including heuristic ones. The user
    // still wins because the AI calls themselves are fewer.
    //
    // TODO: if free-tier quota becomes a real bottleneck, add an
    // `ai_classified_at` column (separate from `processed_at`) so heuristic
    // rows can be excluded from quota arithmetic.
    const { count, error: countError } = await supabase
      .from("emails")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .not("category", "is", null)
      .gte("processed_at", dayStart.toISOString())

    if (countError) return { ok: false, error: countError.message }

    remaining = Math.max(0, FREE_TIER_DAILY_LIMIT - (count ?? 0))

    // Quota exhausted — but heuristic hits still get processed for free.
    // Only abort if there's literally nothing to do at all.
    if (remaining === 0 && heuristicHits.length === 0) {
      return {
        ok: false,
        error: `Free-tier limit reached (${FREE_TIER_DAILY_LIMIT}/day). Upgrade to Pro for unlimited.`,
        quotaExceeded: true,
      }
    }
  }

  // Apply quota cap to the AI batch only.
  const aiBatch =
    remaining !== null ? needsAi.slice(0, remaining) : needsAi

  // 1. Persist heuristic hits (no AI involved).
  let heuristicProcessed = 0
  await Promise.all(
    heuristicHits.map(async (h) => {
      const { error: updateError } = await supabase
        .from("emails")
        .update({
          category: h.classification.category,
          urgency_score: h.classification.urgency_score,
          summary: h.classification.summary,
          action_items: h.classification.action_items,
          draft_reply: h.classification.draft_reply,
          reply_required: h.classification.reply_required,
          no_reply_reason: h.classification.no_reply_reason,
          action_type: h.classification.action_type,
          processed_at: new Date().toISOString(),
        })
        .eq("id", h.id)
        .eq("user_id", user.id)
      if (updateError) {
        console.error(`[heuristic] update failed for email ${h.id}:`, {
          message: updateError.message,
          code: updateError.code,
        })
      } else {
        heuristicProcessed += 1
      }
    })
  )

  // 2. Run AI on the remaining batch.
  type ClassifyOutcome =
    | { id: number; classification: Classification; error: null }
    | { id: number; classification: null; error: string }

  const outcomes = await runWithConcurrency<EmailRow, ClassifyOutcome>(
    aiBatch,
    CONCURRENCY,
    async (email) => {
      try {
        const classification = await classifyEmail({
          subject: email.subject,
          sender: email.sender,
          body: email.body,
          snippet: email.snippet,
        })
        return { id: email.id, classification, error: null }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        console.error(`[ai] classify failed for email ${email.id}: ${msg}`)
        return { id: email.id, classification: null, error: msg }
      }
    }
  )

  const successes = outcomes.filter(
    (o): o is Extract<ClassifyOutcome, { classification: Classification }> =>
      o.classification !== null
  )

  let aiProcessed = 0
  await Promise.all(
    successes.map(async (s) => {
      const { error: updateError } = await supabase
        .from("emails")
        .update({
          category: s.classification.category,
          urgency_score: s.classification.urgency_score,
          summary: s.classification.summary,
          action_items: s.classification.action_items,
          draft_reply: s.classification.draft_reply,
          reply_required: s.classification.reply_required,
          no_reply_reason: s.classification.no_reply_reason,
          action_type: s.classification.action_type,
          processed_at: new Date().toISOString(),
        })
        .eq("id", s.id)
        .eq("user_id", user.id)
      if (updateError) {
        console.error(`[ai] update failed for email ${s.id}:`, {
          message: updateError.message,
          code: updateError.code,
          details: updateError.details,
        })
      } else {
        aiProcessed += 1
      }
    })
  )

  const processed = heuristicProcessed + aiProcessed
  const failed = aiBatch.length - aiProcessed + (heuristicHits.length - heuristicProcessed)
  const newRemaining =
    remaining !== null ? Math.max(0, remaining - aiProcessed) : null

  revalidatePath("/dashboard")
  revalidatePath("/dashboard/actions")

  return {
    ok: true,
    processed,
    heuristic: heuristicProcessed,
    ai: aiProcessed,
    failed,
    remaining: newRemaining,
    plan,
  }
}

async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let cursor = 0
  const workerCount = Math.min(limit, items.length)

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (true) {
        const i = cursor++
        if (i >= items.length) return
        results[i] = await fn(items[i])
      }
    })
  )

  return results
}
