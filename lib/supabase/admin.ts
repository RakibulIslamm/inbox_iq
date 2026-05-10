import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js"
import { readSupabaseEnv, SUPABASE_SETUP_MESSAGE } from "./env"

/**
 * Service-role Supabase client. Bypasses RLS — use ONLY in server-only code
 * paths that need cross-user access (cron jobs, webhooks, admin tools).
 *
 * Never import from client components or expose via API surface.
 */
export function createAdminClient(): SupabaseClient {
  const cfg = readSupabaseEnv()
  if (!cfg.configured) throw new Error(SUPABASE_SETUP_MESSAGE)
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is required for admin operations. Add it to .env.local."
    )
  }
  return createSupabaseClient(cfg.env.url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
