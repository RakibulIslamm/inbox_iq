"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"

export type ToggleActionDoneInput = {
  emailId: number
  done: boolean
}

export type ToggleActionDoneResult =
  | { ok: true; doneAt: string | null }
  | { ok: false; error: string }

/**
 * Persist the per-email "done" toggle on the actions page. Writes
 * `action_done_at = now()` (or null) so the actions list drains as the user
 * marks items complete and survives page reloads.
 */
export async function toggleActionDone(
  input: ToggleActionDoneInput
): Promise<ToggleActionDoneResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Not signed in." }

  const doneAt = input.done ? new Date().toISOString() : null

  const { error } = await supabase
    .from("emails")
    .update({ action_done_at: doneAt })
    .eq("id", input.emailId)
    .eq("user_id", user.id)

  if (error) return { ok: false, error: error.message }

  revalidatePath("/dashboard/actions")
  revalidatePath(`/dashboard/emails/${input.emailId}`)

  return { ok: true, doneAt }
}
