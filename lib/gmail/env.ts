export type GmailEnv = {
  clientId: string
  clientSecret: string
  redirectUri: string
}

export function readGmailEnv():
  | { configured: true; env: GmailEnv }
  | { configured: false } {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const redirectUri = process.env.GOOGLE_REDIRECT_URI
  if (!clientId || !clientSecret || !redirectUri) {
    return { configured: false }
  }
  return { configured: true, env: { clientId, clientSecret, redirectUri } }
}

export const GMAIL_SETUP_MESSAGE =
  "Gmail OAuth is not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI in .env.local."
