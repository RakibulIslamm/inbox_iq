"use server"

import { revalidatePath } from "next/cache"
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  summarizeDay,
  type DailyDigestEmail,
  type DailySummary,
} from "@/lib/ai/agents/summarizer"
import { aiUnavailableMessage, readAIEnv } from "@/lib/ai/env"
import { createClient } from "@/lib/supabase/server"

export type GenerateSummaryResult =
  | { ok: true; summary: DailySummary; emailCount: number; date: string }
  | { ok: false; error: string }

/**
 * User-triggered: derive userId from the Supabase session and write a
 * daily-summary row for today. Idempotent — the unique (user_id, date)
 * constraint causes us to upsert.
 */
export async function generateDailySummary(): Promise<GenerateSummaryResult> {
  const ai = readAIEnv()
  if (!ai.configured) {
    return { ok: false, error: aiUnavailableMessage(ai) }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Not signed in." }

  return generateDailySummaryFor(user.id, supabase)
}

/**
 * Shared core: works with either an RLS-scoped client (server action) or an
 * admin client (cron). Looks at today's classified emails (UTC), runs the
 * summarizer, and upserts into `daily_summaries`.
 */
export async function generateDailySummaryFor(
  userId: string,
  supabase: SupabaseClient
): Promise<GenerateSummaryResult> {
  const today = isoDate(new Date())
  const dayStart = new Date()
  dayStart.setUTCHours(0, 0, 0, 0)

  const { data: emails, error: queryError } = await supabase
    .from("emails")
    .select(
      "subject, sender, category, urgency_score, summary, action_items, draft_reply"
    )
    .eq("user_id", userId)
    .not("category", "is", null)
    .gte("processed_at", dayStart.toISOString())
    .order("urgency_score", { ascending: false, nullsFirst: false })

  if (queryError) return { ok: false, error: queryError.message }

  const digest: DailyDigestEmail[] = (emails ?? []).map((e) => ({
    subject: e.subject,
    sender: e.sender,
    category: e.category,
    urgency_score: e.urgency_score,
    summary: e.summary,
    action_items: (e.action_items as string[] | null) ?? null,
    draft_reply: e.draft_reply,
  }))

  let summary: DailySummary
  try {
    summary = await summarizeDay(digest)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[summary] generation failed:", msg)
    return { ok: false, error: msg }
  }

  const { error: upsertError } = await supabase
    .from("daily_summaries")
    .upsert(
      {
        user_id: userId,
        date: today,
        summary: summary.summary,
        action_items: summary.action_items,
      },
      { onConflict: "user_id,date" }
    )

  if (upsertError) {
    console.error("[summary] upsert failed:", {
      message: upsertError.message,
      code: upsertError.code,
      details: upsertError.details,
    })
    return { ok: false, error: upsertError.message }
  }

  revalidatePath("/dashboard/today")
  return { ok: true, summary, emailCount: digest.length, date: today }
}

function isoDate(d: Date): string {
  // YYYY-MM-DD in UTC, matching the `date` column shape.
  return d.toISOString().slice(0, 10)
}
