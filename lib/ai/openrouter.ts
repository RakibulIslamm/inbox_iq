import OpenAI from "openai"
import { aiUnavailableMessage, readAIEnv } from "./env"

/**
 * Returns an OpenAI-SDK-compatible client pointed at OpenRouter. Identical
 * surface area as the openai client, but `model` strings should be OpenRouter
 * slugs (e.g. "deepseek/deepseek-v4-flash").
 *
 * The HTTP-Referer / X-Title headers are recommended by OpenRouter for
 * attribution and analytics.
 *
 * Defense-in-depth: the throw here should never fire in normal operation —
 * every server action / cron / UI surface that reaches this function has
 * already pre-checked `readAIEnv().configured`. The throw exists only as
 * a safety net so a future code path can't accidentally bypass the kill
 * switch.
 */
export function createOpenRouterClient(): OpenAI {
  const cfg = readAIEnv()
  if (!cfg.configured) throw new Error(aiUnavailableMessage(cfg))

  return new OpenAI({
    apiKey: cfg.env.apiKey,
    baseURL: cfg.env.baseURL,
    defaultHeaders: {
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
      "X-Title": "InboxIQ",
    },
  })
}
