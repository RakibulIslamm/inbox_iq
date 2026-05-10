export type AIEnv = {
  apiKey: string
  baseURL: string
}

/**
 * Default model for InboxIQ agents. Routed through OpenRouter so we can swap
 * providers without code changes — set OPENROUTER_API_KEY and the slug below
 * routes to whatever Anthropic endpoint OpenRouter exposes.
 */
export const DEFAULT_AI_MODEL = "deepseek/deepseek-v4-flash"

/**
 * Reasons AI is unavailable, in priority order:
 *   - "disabled": the operator set `AI_DISABLED=true` (kill switch). Used on
 *     the public Vercel demo so visitors can browse without burning through
 *     the operator's OpenRouter credits.
 *   - "missing": one or more required env vars are absent. Local-dev path —
 *     the user hasn't finished setup yet.
 *
 * `disabled` always wins, even if the keys are present, so the kill switch
 * can be tested locally without unsetting working dev keys.
 */
export type AIEnvResult =
  | { configured: true; env: AIEnv }
  | { configured: false; reason: "disabled" }
  | { configured: false; reason: "missing"; missing: string[] }

export function readAIEnv(): AIEnvResult {
  if (process.env.AI_DISABLED === "true") {
    return { configured: false, reason: "disabled" }
  }

  const apiKey = process.env.OPENROUTER_API_KEY
  const baseURL = process.env.OPENROUTER_BASE_URL
  const missing: string[] = []
  if (!apiKey) missing.push("OPENROUTER_API_KEY")
  if (!baseURL) missing.push("OPENROUTER_BASE_URL")
  if (missing.length > 0) return { configured: false, reason: "missing", missing }
  return { configured: true, env: { apiKey: apiKey!, baseURL: baseURL! } }
}

export const AI_SETUP_MESSAGE =
  "OpenRouter is not configured. Set OPENROUTER_API_KEY and OPENROUTER_BASE_URL in .env.local."

export const AI_DISABLED_MESSAGE =
  "AI features are disabled for this deployment. Clone the repo locally to try them — see README."

/** Single helper so server actions can produce the right error string. */
export function aiUnavailableMessage(
  result: Extract<AIEnvResult, { configured: false }>
): string {
  return result.reason === "disabled" ? AI_DISABLED_MESSAGE : AI_SETUP_MESSAGE
}
