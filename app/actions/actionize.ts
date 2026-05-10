"use server"

import { revalidatePath } from "next/cache"
import {
  actionizeEmail,
  type Actionization,
} from "@/lib/ai/agents/actionizer"
import { aiUnavailableMessage, readAIEnv } from "@/lib/ai/env"
import { createClient } from "@/lib/supabase/server"

const FREE_TIER_DAILY_LIMIT = 10
const CONCURRENCY = 5

export type ActionizeResult =
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
 * Backfill `reply_required`, `no_reply_reason`, and `action_type` for emails
 * that were classified before those columns existed. Only touches rows where
 * `category IS NOT NULL AND action_type IS NULL` — disjoint from the Process
 * button's "category IS NULL" set, so the two can run concurrently without
 * collisions.
 *
 * Counts against the same 10/day free quota as `processEmails` to keep the
 * accounting simple.
 */
export async function actionizeEmails(): Promise<ActionizeResult> {
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
    .select("id, subject, sender, category, summary, action_items, draft_reply")
    .eq("user_id", user.id)
    .not("category", "is", null)
    .is("action_type", null)
    .order("urgency_score", { ascending: false, nullsFirst: false })
    .order("received_at", { ascending: false, nullsFirst: false })

  if (remaining !== null) query = query.limit(remaining)

  const { data: rows, error: queryError } = await query
  if (queryError) return { ok: false, error: queryError.message }
  if (!rows || rows.length === 0) {
    return { ok: true, processed: 0, failed: 0, remaining, plan }
  }

  type Outcome =
    | { id: number; result: Actionization; error: null }
    | { id: number; result: null; error: string }

  const outcomes = await runWithConcurrency<typeof rows[number], Outcome>(
    rows,
    CONCURRENCY,
    async (row) => {
      try {
        const result = await actionizeEmail({
          subject: row.subject,
          sender: row.sender,
          category: row.category,
          summary: row.summary,
          action_items: (row.action_items as string[] | null) ?? [],
          has_draft: row.draft_reply !== null,
        })
        return { id: row.id, result, error: null }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        console.error(`[ai] actionize failed for email ${row.id}: ${msg}`)
        return { id: row.id, result: null, error: msg }
      }
    }
  )

  const successes = outcomes.filter(
    (o): o is Extract<Outcome, { result: Actionization }> => o.result !== null
  )

  let processed = 0
  await Promise.all(
    successes.map(async (s) => {
      const { error: updateError } = await supabase
        .from("emails")
        .update({
          reply_required: s.result.reply_required,
          no_reply_reason: s.result.no_reply_reason,
          action_type: s.result.action_type,
        })
        .eq("id", s.id)
        .eq("user_id", user.id)
      if (updateError) {
        console.error(`[ai] actionize update failed for email ${s.id}:`, {
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

  revalidatePath("/dashboard/actions")
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
