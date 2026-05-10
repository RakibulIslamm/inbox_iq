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

export function readAIEnv():
  | { configured: true; env: AIEnv }
  | { configured: false } {
  const apiKey = process.env.OPENROUTER_API_KEY
  const baseURL = process.env.OPENROUTER_BASE_URL
  if (!apiKey || !baseURL) return { configured: false }
  return { configured: true, env: { apiKey, baseURL } }
}

export const AI_SETUP_MESSAGE =
  "OpenRouter is not configured. Set OPENROUTER_API_KEY and OPENROUTER_BASE_URL in .env.local."
