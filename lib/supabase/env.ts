export type SupabaseEnv = {
  url: string
  anonKey: string
}

export function readSupabaseEnv():
  | { configured: true; env: SupabaseEnv }
  | { configured: false } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) return { configured: false }
  return { configured: true, env: { url, anonKey } }
}

export const SUPABASE_SETUP_MESSAGE =
  "Supabase is not configured. Copy .env.local.example to .env.local and fill in NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY from Supabase Dashboard → Project Settings → API."
