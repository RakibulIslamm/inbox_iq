"use server"

import { revalidatePath } from "next/cache"
import {
  classifyEmail,
  type Classification,
} from "@/lib/ai/agents/classifier"
import { readAIEnv } from "@/lib/ai/env"
import { createClient } from "@/lib/supabase/server"

const FREE_TIER_DAILY_LIMIT = 10
const CONCURRENCY = 5

export type ProcessResult =
  | {
      ok: true
      processed: number
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
 * Classify all of the user's currently-unprocessed emails. Concurrency is
 * capped at 5; free-tier users are capped to 10 classifications per
 * calendar day (UTC), enforced via `processed_at`.
 */
export async function processEmails(): Promise<ProcessResult> {
  if (!readAIEnv().configured) {
    return { ok: false, error: "OpenRouter API is not configured." }
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

  let remaining: number | null = null
  if (plan === "free") {
    const dayStart = new Date()
    dayStart.setHours(0, 0, 0, 0)

    const { count, error: countError } = await supabase
      .from("emails")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .not("category", "is", null)
      .gte("processed_at", dayStart.toISOString())

    if (countError) {
      return { ok: false, error: countError.message }
    }

    remaining = Math.max(0, FREE_TIER_DAILY_LIMIT - (count ?? 0))
    if (remaining === 0) {
      return {
        ok: false,
        error: `Free-tier limit reached (${FREE_TIER_DAILY_LIMIT}/day). Upgrade to Pro for unlimited.`,
        quotaExceeded: true,
      }
    }
  }

  let query = supabase
    .from("emails")
    .select("id, subject, sender, snippet, body")
    .eq("user_id", user.id)
    .is("category", null)
    .order("received_at", { ascending: false, nullsFirst: false })

  if (remaining !== null) query = query.limit(remaining)

  const { data: unprocessed, error: queryError } = await query
  if (queryError) return { ok: false, error: queryError.message }
  if (!unprocessed || unprocessed.length === 0) {
    return { ok: true, processed: 0, failed: 0, remaining, plan }
  }

  type ClassifyOutcome =
    | { id: number; classification: Classification; error: null }
    | { id: number; classification: null; error: string }

  const outcomes = await runWithConcurrency<typeof unprocessed[number], ClassifyOutcome>(
    unprocessed,
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

  let processed = 0
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
        processed += 1
      }
    })
  )

  const failed = outcomes.length - processed
  const newRemaining = remaining !== null ? Math.max(0, remaining - processed) : null

  revalidatePath("/dashboard")

  return {
    ok: true,
    processed,
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
