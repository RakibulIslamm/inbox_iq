import { cookies } from "next/headers"
import { NextResponse, type NextRequest } from "next/server"
import { google } from "googleapis"
import { readGmailEnv } from "@/lib/gmail/env"
import { createOAuthClient, GMAIL_STATE_COOKIE } from "@/lib/gmail/oauth"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  const { origin, searchParams } = new URL(request.url)
  const code = searchParams.get("code")
  const state = searchParams.get("state")
  const oauthError = searchParams.get("error")

  const fail = (reason: string) =>
    NextResponse.redirect(
      new URL(`/dashboard?gmail_error=${encodeURIComponent(reason)}`, origin)
    )

  if (oauthError) return fail(oauthError)
  if (!readGmailEnv().configured) return fail("gmail_not_configured")
  if (!code || !state) return fail("missing_params")

  const cookieStore = await cookies()
  const stored = cookieStore.get(GMAIL_STATE_COOKIE)?.value
  // Always clear the state cookie — single-use.
  cookieStore.delete(GMAIL_STATE_COOKIE)
  if (!stored || stored !== state) return fail("state_mismatch")

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(new URL("/login", origin))
  }

  let tokens: {
    access_token?: string | null
    refresh_token?: string | null
    expiry_date?: number | null
  }
  try {
    const oauth = createOAuthClient()
    const exchanged = await oauth.getToken(code)
    tokens = exchanged.tokens
  } catch (e) {
    console.error("[gmail] code exchange failed", e)
    return fail("exchange_failed")
  }

  if (!tokens.refresh_token) {
    // Without a refresh_token we can't keep syncing. The most common cause
    // is that the user previously granted access without prompt=consent;
    // we already pass prompt=consent so this should be rare.
    return fail("no_refresh_token")
  }

  // Fetch the actual Gmail address that was authorised so the dashboard can
  // render "Connected · alice@gmail.com" instead of a generic badge. This is
  // best-effort — if it fails the connection still works.
  let gmailAddress: string | null = null
  try {
    const oauth = createOAuthClient()
    oauth.setCredentials(tokens)
    const gmail = google.gmail({ version: "v1", auth: oauth })
    const profileRes = await gmail.users.getProfile({ userId: "me" })
    gmailAddress = profileRes.data.emailAddress ?? null
  } catch (e) {
    console.warn("[gmail] could not fetch profile email:", e)
  }

  const { error: upsertError } = await supabase
    .from("gmail_connections")
    .upsert(
      {
        user_id: user.id,
        refresh_token: tokens.refresh_token,
        access_token: tokens.access_token ?? null,
        expires_at: tokens.expiry_date
          ? new Date(tokens.expiry_date).toISOString()
          : null,
        gmail_email: gmailAddress,
      },
      { onConflict: "user_id" }
    )

  if (upsertError) {
    console.error("[gmail] failed to save tokens:", {
      message: upsertError.message,
      code: upsertError.code,
      details: upsertError.details,
      hint: upsertError.hint,
    })
    return fail("persist_failed")
  }

  return NextResponse.redirect(new URL("/dashboard?gmail=connected", origin))
}
