import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const next = searchParams.get("next") ?? "/dashboard"
  const error = searchParams.get("error")
  const errorDescription = searchParams.get("error_description")

  if (error) {
    const url = new URL("/login", origin)
    url.searchParams.set("error", errorDescription ?? error)
    return NextResponse.redirect(url)
  }

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=missing_code", origin))
  }

  const supabase = await createClient()
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

  if (exchangeError) {
    const url = new URL("/login", origin)
    url.searchParams.set("error", "auth_callback_failed")
    return NextResponse.redirect(url)
  }

  return NextResponse.redirect(new URL(next, origin))
}
