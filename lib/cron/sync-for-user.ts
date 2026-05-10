import type { SupabaseClient } from "@supabase/supabase-js"
import { classifyEmail } from "@/lib/ai/agents/classifier"
import { fetchRecentEmails } from "@/lib/gmail/fetch"
import {
  GmailNotConnectedError,
  GmailReauthRequiredError,
} from "@/lib/gmail/client"

const FREE_TIER_DAILY_LIMIT = 10
const CLASSIFY_CONCURRENCY = 5

export type SyncForUserResult = {
  userId: string
  ok: boolean
  ingested: number
  classified: number
  failedClassifications: number
  skippedReason?: string
  error?: string
}

/**
 * One-shot incremental sync + classify for a single user, using a
 * service-role Supabase client so it can be invoked from the cron route.
 *
 * Steps:
 *   1. Read `profiles.last_synced_at` watermark + plan.
 *   2. Pull Gmail messages received after the watermark (paginated, no cap).
 *   3. Upsert into `emails`, then bump the watermark.
 *   4. Classify any remaining `category IS NULL` rows for this user, capped
 *      at the user's daily quota for free tier (10/day) or unlimited for pro.
 *
 * Errors at any step short-circuit with `ok: false` — they don't poison
 * subsequent users in the cron loop.
 */
export async function syncAndClassifyForUser(
  userId: string,
  supabase: SupabaseClient
): Promise<SyncForUserResult> {
  const out: SyncForUserResult = {
    userId,
    ok: true,
    ingested: 0,
    classified: 0,
    failedClassifications: 0,
  }

  // 1. Profile state
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("plan, last_synced_at")
    .eq("id", userId)
    .maybeSingle()
  if (profileError) {
    return { ...out, ok: false, error: `profile read: ${profileError.message}` }
  }

  const plan: "free" | "pro" = profile?.plan === "pro" ? "pro" : "free"
  const since = profile?.last_synced_at
    ? new Date(profile.last_synced_at as string)
    : null
  const newWatermark = new Date()

  // 2. Fetch (incremental)
  let messages
  try {
    messages = await fetchRecentEmails(userId, { since }, supabase)
  } catch (e) {
    if (e instanceof GmailNotConnectedError) {
      return { ...out, skippedReason: "not_connected" }
    }
    if (e instanceof GmailReauthRequiredError) {
      return { ...out, ok: false, error: "reauth_required" }
    }
    const msg = e instanceof Error ? e.message : String(e)
    return { ...out, ok: false, error: `gmail fetch: ${msg}` }
  }

  // 3. Upsert + watermark
  if (messages.length > 0) {
    const rows = messages.map((m) => ({
      user_id: userId,
      gmail_message_id: m.gmailMessageId,
      thread_id: m.threadId,
      message_id_header: m.messageIdHeader,
      subject: m.subject,
      sender: m.sender,
      to_header: m.to,
      cc_header: m.cc,
      snippet: m.snippet,
      body: m.body,
      received_at: m.receivedAt ? m.receivedAt.toISOString() : null,
    }))
    const { error: upsertError, count } = await supabase
      .from("emails")
      .upsert(rows, {
        onConflict: "user_id,gmail_message_id",
        ignoreDuplicates: false,
        count: "exact",
      })
    if (upsertError) {
      return { ...out, ok: false, error: `upsert: ${upsertError.message}` }
    }
    out.ingested = count ?? rows.length
  }

  // Bump watermark even on a zero-message run — the sync ran successfully.
  await supabase
    .from("profiles")
    .update({ last_synced_at: newWatermark.toISOString() })
    .eq("id", userId)

  // 4. Classify any unprocessed emails, capped by quota for free users.
  let classifyBudget: number | null = null
  if (plan === "free") {
    const dayStart = new Date()
    dayStart.setUTCHours(0, 0, 0, 0)
    const { count: classifiedToday } = await supabase
      .from("emails")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .not("category", "is", null)
      .gte("processed_at", dayStart.toISOString())
    classifyBudget = Math.max(
      0,
      FREE_TIER_DAILY_LIMIT - (classifiedToday ?? 0)
    )
    if (classifyBudget === 0) {
      out.skippedReason = "free_quota_exhausted"
      return out
    }
  }

  let unprocessedQuery = supabase
    .from("emails")
    .select("id, subject, sender, snippet, body")
    .eq("user_id", userId)
    .is("category", null)
    .order("received_at", { ascending: false, nullsFirst: false })
  if (classifyBudget !== null) {
    unprocessedQuery = unprocessedQuery.limit(classifyBudget)
  }
  const { data: unprocessed, error: unprocessedError } = await unprocessedQuery
  if (unprocessedError) {
    return { ...out, ok: false, error: `unprocessed read: ${unprocessedError.message}` }
  }
  if (!unprocessed || unprocessed.length === 0) return out

  type EmailRow = {
    id: number
    subject: string | null
    sender: string | null
    snippet: string | null
    body: string | null
  }

  const items = unprocessed as EmailRow[]
  let classified = 0
  let failed = 0
  let cursor = 0
  await Promise.all(
    Array.from({ length: Math.min(CLASSIFY_CONCURRENCY, items.length) }, async () => {
      while (true) {
        const i = cursor++
        if (i >= items.length) return
        const email = items[i]
        try {
          const c = await classifyEmail({
            subject: email.subject,
            sender: email.sender,
            body: email.body,
            snippet: email.snippet,
          })
          const { error: updateError } = await supabase
            .from("emails")
            .update({
              category: c.category,
              urgency_score: c.urgency_score,
              summary: c.summary,
              action_items: c.action_items,
              draft_reply: c.draft_reply,
              processed_at: new Date().toISOString(),
            })
            .eq("id", email.id)
            .eq("user_id", userId)
          if (updateError) {
            failed += 1
            console.warn(
              `[cron] update failed for email ${email.id}:`,
              updateError.message
            )
          } else {
            classified += 1
          }
        } catch (e) {
          failed += 1
          const msg = e instanceof Error ? e.message : String(e)
          console.warn(`[cron] classify failed for email ${email.id}: ${msg}`)
        }
      }
    })
  )

  out.classified = classified
  out.failedClassifications = failed
  return out
}
