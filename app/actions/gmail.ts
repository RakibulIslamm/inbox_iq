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

export async function syncEmails(): Promise<SyncResult> {
  if (!readGmailEnv().configured) {
    return { ok: false, error: "Gmail OAuth is not configured." }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Not signed in." }

  let messages: SimplifiedEmail[]
  try {
    messages = await fetchRecentEmails(user.id, 50)
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
    return { ok: true, synced: 0, skipped: 0 }
  }

  const rows = messages.map((m) => ({
    user_id: user.id,
    gmail_message_id: m.gmailMessageId,
    subject: m.subject,
    sender: m.sender,
    snippet: m.snippet,
    body: m.body,
    received_at: m.receivedAt ? m.receivedAt.toISOString() : null,
    processed_at: new Date().toISOString(),
  }))

  // Upsert against (user_id, gmail_message_id). Existing rows stay, but their
  // structural fields are refreshed; AI fields (category/summary/etc.) are
  // untouched because we don't include them in the upsert payload.
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
