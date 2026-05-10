import Stripe from "stripe"
import { readStripeEnv, STRIPE_SETUP_MESSAGE } from "./env"

/**
 * Server-only Stripe client. Pinned to a specific API version so behavior
 * doesn't drift when Stripe rolls out new defaults.
 */
export function createStripeClient(): Stripe {
  const cfg = readStripeEnv()
  if (!cfg.configured) throw new Error(STRIPE_SETUP_MESSAGE)
  return new Stripe(cfg.env.secretKey, {
    // Pinned API version matching the installed SDK (stripe@22).
    apiVersion: "2026-04-22.dahlia",
    typescript: true,
    appInfo: {
      name: "InboxIQ",
      url: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
    },
  })
}
