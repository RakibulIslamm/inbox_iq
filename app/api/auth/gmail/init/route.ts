import { cookies } from "next/headers"
import { NextResponse, type NextRequest } from "next/server"
import { readGmailEnv } from "@/lib/gmail/env"
import {
  buildConsentUrl,
  generateOAuthState,
  GMAIL_STATE_COOKIE,
  GMAIL_STATE_COOKIE_MAX_AGE,
} from "@/lib/gmail/oauth"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  const { origin } = new URL(request.url)

  if (!readGmailEnv().configured) {
    return NextResponse.redirect(
      new URL("/dashboard?error=gmail_not_configured", origin)
    )
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(new URL("/login", origin))
  }

  const state = generateOAuthState()
  const consentUrl = buildConsentUrl(state)

  const cookieStore = await cookies()
  cookieStore.set(GMAIL_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: GMAIL_STATE_COOKIE_MAX_AGE,
  })

  return NextResponse.redirect(consentUrl)
}
