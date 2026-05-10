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
  | { ok: true; synced: number; skipped: number }
  | { ok: false; error: string; reauth?: boolean; notConnected?: boolean }

/** Cap on the manual "Sync now" pull. Cron runs unbounded with `since`. */
const MANUAL_SYNC_LIMIT = 200

export async function syncEmails(): Promise<SyncResult> {
  if (!readGmailEnv().configured) {
    return { ok: false, error: "Gmail OAuth is not configured." }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Not signed in." }

  // Read the watermark from the previous sync. On a brand-new connection
  // this is null, so the first sync falls back to the most recent N
  // INBOX messages without a `since` filter.
  const { data: profile } = await supabase
    .from("profiles")
    .select("last_synced_at")
    .eq("id", user.id)
    .maybeSingle()
  const since = profile?.last_synced_at
    ? new Date(profile.last_synced_at as string)
    : null

  // Capture the boundary BEFORE the fetch so we don't lose messages that
  // arrive while we're still pulling pages.
  const newWatermark = new Date()

  let messages: SimplifiedEmail[]
  try {
    messages = await fetchRecentEmails(user.id, {
      since,
      limit: MANUAL_SYNC_LIMIT,
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

  if (messages.length === 0) {
    // Still bump the watermark — there's nothing new but the sync ran.
    await supabase
      .from("profiles")
      .update({ last_synced_at: newWatermark.toISOString() })
      .eq("id", user.id)
    revalidatePath("/dashboard")
    return { ok: true, synced: 0, skipped: 0 }
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

  // Upsert against (user_id, gmail_message_id). New rows get processed_at via
  // the column default. Existing rows keep their processed_at (we omit it
  // from the payload), and their AI fields (category/summary/etc.) stay
  // untouched. processed_at is overwritten only by the AI processor in
  // app/actions/process.ts, which is what the daily-quota check reads.
  const { error: upsertError, count } = await supabase
    .from("emails")
    .upsert(rows, {
      onConflict: "user_id,gmail_message_id",
      ignoreDuplicates: false,
      count: "exact",
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
    synced: count ?? rows.length,
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
