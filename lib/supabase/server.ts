import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { readSupabaseEnv, SUPABASE_SETUP_MESSAGE } from "./env"

export async function createClient() {
  const supabaseEnv = readSupabaseEnv()
  if (!supabaseEnv.configured) {
    throw new Error(SUPABASE_SETUP_MESSAGE)
  }

  const cookieStore = await cookies()

  return createServerClient(supabaseEnv.env.url, supabaseEnv.env.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        } catch {
          // Called from a Server Component — safe to ignore.
          // Middleware refreshes the session on every request.
        }
      },
    },
  })
}
