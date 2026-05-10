import { google, type gmail_v1 } from "googleapis"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server"
import { readGmailEnv, GMAIL_SETUP_MESSAGE } from "./env"

export class GmailNotConnectedError extends Error {
  constructor() {
    super("Gmail is not connected. Connect Gmail in the dashboard first.")
    this.name = "GmailNotConnectedError"
  }
}

export class GmailReauthRequiredError extends Error {
  constructor(cause?: unknown) {
    super("Gmail authorization expired. Reconnect Gmail in the dashboard.")
    this.name = "GmailReauthRequiredError"
    if (cause !== undefined) this.cause = cause
  }
}

/**
 * Returns an authenticated Gmail API client for the given user.
 *
 * - In a normal request path, omit `supabase`; we'll build a request-scoped
 *   server client and rely on RLS.
 * - In a cron / admin path with no user session, pass an admin (service-role)
 *   client so token reads/writes work without a Supabase auth cookie.
 *
 * The underlying OAuth2 client refreshes the access token on 401; the
 * `tokens` event listener persists the refreshed token using the same
 * Supabase client we received here.
 */
export async function getGmailClient(
  userId: string,
  supabase?: SupabaseClient
): Promise<gmail_v1.Gmail> {
  const cfg = readGmailEnv()
  if (!cfg.configured) {
    throw new Error(GMAIL_SETUP_MESSAGE)
  }

  const db = supabase ?? (await createSupabaseServerClient())
  const { data: row, error } = await db
    .from("gmail_connections")
    .select("refresh_token, access_token, expires_at")
    .eq("user_id", userId)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to read gmail_connections: ${error.message}`)
  }
  if (!row) {
    throw new GmailNotConnectedError()
  }

  const oauth = new google.auth.OAuth2(
    cfg.env.clientId,
    cfg.env.clientSecret,
    cfg.env.redirectUri
  )
  oauth.setCredentials({
    refresh_token: row.refresh_token,
    access_token: row.access_token ?? undefined,
    expiry_date: row.expires_at ? new Date(row.expires_at).getTime() : undefined,
  })

  // Fired by googleapis whenever the client refreshes the access token.
  oauth.on("tokens", (tokens) => {
    void persistRefreshedTokens(userId, tokens, db).catch((e) => {
      console.error("[gmail] failed to persist refreshed tokens", e)
    })
  })

  return google.gmail({ version: "v1", auth: oauth })
}

async function persistRefreshedTokens(
  userId: string,
  tokens: {
    access_token?: string | null
    refresh_token?: string | null
    expiry_date?: number | null
  },
  supabase: SupabaseClient
) {
  const update: Record<string, unknown> = {}
  if (tokens.access_token) update.access_token = tokens.access_token
  if (tokens.expiry_date) {
    update.expires_at = new Date(tokens.expiry_date).toISOString()
  }
  // Google occasionally rotates refresh tokens; persist when it does.
  if (tokens.refresh_token) update.refresh_token = tokens.refresh_token
  if (Object.keys(update).length === 0) return

  const { error } = await supabase
    .from("gmail_connections")
    .update(update)
    .eq("user_id", userId)
  if (error) throw new Error(error.message)
}

/**
 * Heuristic: Google's `invalid_grant` (refresh token revoked or expired) is
 * the canonical "user must reconnect" signal.
 */
export function isReauthRequiredError(e: unknown): boolean {
  if (!e || typeof e !== "object") return false
  const err = e as {
    code?: number | string
    message?: string
    response?: { data?: { error?: string } }
  }
  if (err.response?.data?.error === "invalid_grant") return true
  if (err.code === 401) return true
  if (typeof err.message === "string" && /invalid_grant|invalid_token/i.test(err.message)) {
    return true
  }
  return false
}
