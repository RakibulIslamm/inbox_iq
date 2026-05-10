"use server"

import { revalidatePath } from "next/cache"
import { regenerateReply } from "@/lib/ai/agents/reply"
import { aiUnavailableMessage, readAIEnv } from "@/lib/ai/env"
import {
  GmailNotConnectedError,
  GmailReauthRequiredError,
} from "@/lib/gmail/client"
import { sendReply as sendReplyViaGmail } from "@/lib/gmail/send"
import { createClient } from "@/lib/supabase/server"

export type SendReplyInput = {
  emailId: number
  body: string
}

export type SendReplyResult =
  | { ok: true; messageId: string }
  | { ok: false; error: string; reauth?: boolean }

export async function sendReply(input: SendReplyInput): Promise<SendReplyResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Not signed in." }

  if (!input.body || input.body.trim().length === 0) {
    return { ok: false, error: "Reply body is empty." }
  }

  const { data: row, error } = await supabase
    .from("emails")
    .select("id, sender, subject, message_id_header, thread_id, action_type")
    .eq("id", input.emailId)
    .eq("user_id", user.id)
    .maybeSingle()

  if (error) return { ok: false, error: error.message }
  if (!row) return { ok: false, error: "Email not found." }
  if (!row.sender) return { ok: false, error: "Original email has no sender." }

  try {
    const result = await sendReplyViaGmail({
      userId: user.id,
      to: row.sender,
      originalSubject: row.subject,
      inReplyTo: row.message_id_header,
      threadId: row.thread_id,
      body: input.body,
    })

    const now = new Date().toISOString()
    // Drain the actions list naturally: once the user actually replies, mark
    // a "reply" action as done so the email leaves the open-actions bucket.
    // Other action_types (pay, sign, …) need an explicit checkbox toggle.
    const update: { replied_at: string; action_done_at?: string } = { replied_at: now }
    if (row.action_type === "reply") update.action_done_at = now

    await supabase
      .from("emails")
      .update(update)
      .eq("id", row.id)
      .eq("user_id", user.id)

    revalidatePath(`/dashboard/emails/${row.id}`)
    revalidatePath("/dashboard")
    revalidatePath("/dashboard/actions")

    return { ok: true, messageId: result.messageId }
  } catch (e) {
    if (e instanceof GmailNotConnectedError) {
      return { ok: false, error: e.message }
    }
    if (e instanceof GmailReauthRequiredError) {
      return { ok: false, error: e.message, reauth: true }
    }
    const msg = e instanceof Error ? e.message : "Unknown send error."
    console.error("[email] send failed:", msg)
    return { ok: false, error: msg }
  }
}

export type RegenerateInput = {
  emailId: number
  tone?: "shorter" | "longer" | "more-formal" | "more-casual" | null
}

export type RegenerateResult =
  | { ok: true; draft: string }
  | { ok: false; error: string }

export async function regenerateDraft(
  input: RegenerateInput
): Promise<RegenerateResult> {
  const ai = readAIEnv()
  if (!ai.configured) {
    return { ok: false, error: aiUnavailableMessage(ai) }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Not signed in." }

  const { data: row, error } = await supabase
    .from("emails")
    .select("id, subject, sender, snippet, body")
    .eq("id", input.emailId)
    .eq("user_id", user.id)
    .maybeSingle()

  if (error) return { ok: false, error: error.message }
  if (!row) return { ok: false, error: "Email not found." }

  try {
    const draft = await regenerateReply({
      subject: row.subject,
      sender: row.sender,
      body: row.body,
      snippet: row.snippet,
      tone: input.tone ?? null,
    })

    await supabase
      .from("emails")
      .update({ draft_reply: draft })
      .eq("id", row.id)
      .eq("user_id", user.id)

    revalidatePath(`/dashboard/emails/${row.id}`)
    return { ok: true, draft }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown regenerate error."
    console.error("[email] regenerate failed:", msg)
    return { ok: false, error: msg }
  }
}
