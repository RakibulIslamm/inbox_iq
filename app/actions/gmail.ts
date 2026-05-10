"use server"

import { revalidatePath } from "next/cache"
import { google } from "googleapis"
import {
  fetchRecentEmails,
  type SimplifiedEmail,
} from "@/lib/gmail/fetch"
import {
  GmailNotConnectedError,
  GmailReauthRequiredError,
} from "@/lib/gmail/client"
import { readGmailEnv } from "@/lib/gmail/env"
import { createClient } from "@/lib/supabase/server"

export type SyncResult =
  | {
      ok: true
      /** Truly new rows inserted (gmail_message_id wasn't in DB yet). */
      synced: number
      /** Existing rows the sync re-touched (already in DB, fields refreshed). */
      updated: number
      /** Total `category IS NULL` rows across the user's inbox after the
       *  sync — i.e. how many are now waiting for the Process button. Lets
       *  the toast distinguish "Synced 5, 3 ready to classify" from
       *  "Synced 5, but they're all duplicates of already-classified mail". */
      unprocessed: number
      skipped: number
    }
  | { ok: false; error: string; reauth?: boolean; notConnected?: boolean }

/**
 * Per-plan caps on the manual "Sync now" pull. Free is tighter because
 * each synced email turns into a potential AI classification call inside
 * the daily 10-message quota — pulling ancient inbox just wastes budget.
 * Pro has unlimited AI, so the cap is mostly a runaway-protection guard.
 * Cron runs unbounded with `since` regardless of plan.
 */
const MANUAL_SYNC_LIMIT_FREE = 50
const MANUAL_SYNC_LIMIT_PRO = 200

export async function syncEmails(): Promise<SyncResult> {
  if (!readGmailEnv().configured) {
    return { ok: false, error: "Gmail OAuth is not configured." }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Not signed in." }

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan, last_synced_at")
    .eq("id", user.id)
    .maybeSingle()

  const plan: "free" | "pro" = profile?.plan === "pro" ? "pro" : "free"
  const lastSynced = profile?.last_synced_at
    ? new Date(profile.last_synced_at as string)
    : null

  // Plan-aware sync window:
  //   - Pro: trust the watermark. First sync (lastSynced=null) → no `since`
  //     filter, so the most-recent N (cap below) INBOX messages get pulled.
  //     Subsequent syncs are pure incremental — no data is silently dropped.
  //   - Free: clamp `since` to the later of (last_synced_at, today's 00:00).
  //     This keeps the 10/day AI quota focused on fresh mail; users won't
  //     burn it classifying last week's backlog. Costs them some history,
  //     but they can upgrade to Pro to get the full window.
  let since: Date | null
  if (plan === "pro") {
    since = lastSynced
  } else {
    const dayStart = new Date()
    dayStart.setHours(0, 0, 0, 0)
    since = lastSynced && lastSynced > dayStart ? lastSynced : dayStart
  }
  const limit = plan === "pro" ? MANUAL_SYNC_LIMIT_PRO : MANUAL_SYNC_LIMIT_FREE

  // Capture the boundary BEFORE the fetch so we don't lose messages that
  // arrive while we're still pulling pages.
  const newWatermark = new Date()

  let messages: SimplifiedEmail[]
  try {
    messages = await fetchRecentEmails(user.id, {
      since,
      limit,
    })
  } catch (e) {
    if (e instanceof GmailNotConnectedError) {
      return { ok: false, error: e.message, notConnected: true }
    }
    if (e instanceof GmailReauthRequiredError) {
      return { ok: false, error: e.message, reauth: true }
    }
    console.error("[gmail] sync failed", e)
    const msg = e instanceof Error ? e.message : "Unknown sync error."
    return { ok: false, error: msg }
  }

  // Always tell the user how many rows are sitting unprocessed after the
  // sync — that's the count Process will actually classify. Computed once
  // at the end via this helper to keep both return paths consistent.
  const countUnprocessed = async (): Promise<number> => {
    const { count: pending } = await supabase
      .from("emails")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .is("category", null)
    return pending ?? 0
  }

  if (messages.length === 0) {
    // Still bump the watermark — there's nothing new but the sync ran.
    await supabase
      .from("profiles")
      .update({ last_synced_at: newWatermark.toISOString() })
      .eq("id", user.id)
    revalidatePath("/dashboard")
    return {
      ok: true,
      synced: 0,
      updated: 0,
      unprocessed: await countUnprocessed(),
      skipped: 0,
    }
  }

  const rows = messages.map((m) => ({
    user_id: user.id,
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

  // Pre-query existing gmail_message_ids in this batch so we can report
  // truly-new vs. re-touched separately. Without this, `count` from
  // upsert lumps inserts and ON CONFLICT updates together, which makes
  // "Synced 5" look promising even when all 5 are already-classified
  // rows that the Process button will skip.
  const incomingIds = rows.map((r) => r.gmail_message_id)
  const { data: existingRows } = await supabase
    .from("emails")
    .select("gmail_message_id")
    .eq("user_id", user.id)
    .in("gmail_message_id", incomingIds)
  const existingIdSet = new Set(
    (existingRows ?? []).map((r) => r.gmail_message_id as string)
  )
  const newCount = incomingIds.filter((id) => !existingIdSet.has(id)).length
  const updatedCount = incomingIds.length - newCount

  // Upsert against (user_id, gmail_message_id). New rows get processed_at via
  // the column default. Existing rows keep their processed_at (we omit it
  // from the payload), and their AI fields (category/summary/etc.) stay
  // untouched. processed_at is overwritten only by the AI processor in
  // app/actions/process.ts, which is what the daily-quota check reads.
  const { error: upsertError } = await supabase
    .from("emails")
    .upsert(rows, {
      onConflict: "user_id,gmail_message_id",
      ignoreDuplicates: false,
    })

  if (upsertError) {
    console.error("[gmail] upsert failed:", {
      message: upsertError.message,
      code: upsertError.code,
      details: upsertError.details,
      hint: upsertError.hint,
    })
    return { ok: false, error: upsertError.message }
  }

  // Bump watermark only after a successful upsert. If the upsert fails the
  // next sync will still try to pull the same window — cheap retry.
  await supabase
    .from("profiles")
    .update({ last_synced_at: newWatermark.toISOString() })
    .eq("id", user.id)

  revalidatePath("/dashboard")
  return {
    ok: true,
    synced: newCount,
    updated: updatedCount,
    unprocessed: await countUnprocessed(),
    skipped: messages.length - rows.length,
  }
}

/**
 * Best-effort disconnect: revokes the token at Google, deletes the local row.
 * Used directly by `<form action={disconnectGmail}>` so it returns void.
 * Failures are logged; the user can retry.
 */
export async function disconnectGmail(): Promise<void> {
  const cfg = readGmailEnv()

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  const { data: row } = await supabase
    .from("gmail_connections")
    .select("refresh_token, access_token")
    .eq("user_id", user.id)
    .maybeSingle()

  if (cfg.configured && row) {
    try {
      const oauth = new google.auth.OAuth2(
        cfg.env.clientId,
        cfg.env.clientSecret,
        cfg.env.redirectUri
      )
      const tokenToRevoke = row.access_token ?? row.refresh_token
      if (tokenToRevoke) await oauth.revokeToken(tokenToRevoke)
    } catch (e) {
      // Token may already be invalid — log and continue.
      console.warn("[gmail] revoke failed (continuing)", e)
    }
  }

  const { error } = await supabase
    .from("gmail_connections")
    .delete()
    .eq("user_id", user.id)

  if (error) {
    console.error("[gmail] failed to delete connection:", {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    })
  }

  revalidatePath("/dashboard")
}
