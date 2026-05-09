import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { readSupabaseEnv } from "./env"

const PROTECTED_PREFIXES = ["/dashboard"]
let warned = false

export async function updateSession(request: NextRequest) {
  const supabaseEnv = readSupabaseEnv()

  // If Supabase isn't configured yet, let pages render so devs can see the
  // landing page before completing setup. Auth-protected routes will still
  // surface a setup message via the page-level guards.
  if (!supabaseEnv.configured) {
    if (!warned) {
      warned = true
      console.warn(
        "[supabase] NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are not set. Skipping session refresh."
      )
    }
    return NextResponse.next({ request })
  }

  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    supabaseEnv.env.url,
    supabaseEnv.env.anonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: getUser() validates the JWT against Supabase Auth.
  // getSession() only reads the cookie locally — don't use it here.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname
  const isProtected = PROTECTED_PREFIXES.some((p) => path.startsWith(p))

  if (!user && isProtected) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    url.searchParams.set("redirect", path)
    return NextResponse.redirect(url)
  }

  return response
}
