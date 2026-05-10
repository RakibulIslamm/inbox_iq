import { randomBytes } from "node:crypto"
import { google } from "googleapis"
import { readGmailEnv, GMAIL_SETUP_MESSAGE } from "./env"

/**
 * Phase 2 used readonly only. Phase 4 adds `gmail.send` so we can ship
 * AI-drafted replies. Existing users will be re-prompted by Google when
 * they next click Connect Gmail (because of the new scope), thanks to
 * `prompt=consent` + `include_granted_scopes=true` in `buildConsentUrl`.
 */
export const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
] as const

export const GMAIL_STATE_COOKIE = "inboxiq_gmail_oauth_state"
export const GMAIL_STATE_COOKIE_MAX_AGE = 60 * 5 // 5 minutes

export function createOAuthClient() {
  const cfg = readGmailEnv()
  if (!cfg.configured) {
    throw new Error(GMAIL_SETUP_MESSAGE)
  }
  return new google.auth.OAuth2(
    cfg.env.clientId,
    cfg.env.clientSecret,
    cfg.env.redirectUri
  )
}

export function buildConsentUrl(state: string): string {
  const client = createOAuthClient()
  return client.generateAuthUrl({
    access_type: "offline",
    // prompt=consent guarantees a refresh_token even on re-auth.
    // Without it, Google omits refresh_token after the first grant.
    prompt: "consent",
    scope: GMAIL_SCOPES as unknown as string[],
    include_granted_scopes: true,
    state,
  })
}

export function generateOAuthState(): string {
  return randomBytes(24).toString("base64url")
}
