import OpenAI from "openai"
import { AI_SETUP_MESSAGE, readAIEnv } from "./env"

/**
 * Returns an OpenAI-SDK-compatible client pointed at OpenRouter. Identical
 * surface area as the openai client, but `model` strings should be OpenRouter
 * slugs (e.g. "deepseek/deepseek-v4-flash").
 *
 * The HTTP-Referer / X-Title headers are recommended by OpenRouter for
 * attribution and analytics.
 */
export function createOpenRouterClient(): OpenAI {
  const cfg = readAIEnv()
  if (!cfg.configured) throw new Error(AI_SETUP_MESSAGE)

  return new OpenAI({
    apiKey: cfg.env.apiKey,
    baseURL: cfg.env.baseURL,
    defaultHeaders: {
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
      "X-Title": "InboxIQ",
    },
  })
}
