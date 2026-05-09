import { createBrowserClient } from "@supabase/ssr"
import { readSupabaseEnv, SUPABASE_SETUP_MESSAGE } from "./env"

export function createClient() {
  const supabaseEnv = readSupabaseEnv()
  if (!supabaseEnv.configured) {
    throw new Error(SUPABASE_SETUP_MESSAGE)
  }
  return createBrowserClient(supabaseEnv.env.url, supabaseEnv.env.anonKey)
}
