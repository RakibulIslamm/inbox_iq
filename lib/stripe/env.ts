export type StripeEnv = {
  secretKey: string
  webhookSecret: string
  priceId: string
}

export function readStripeEnv():
  | { configured: true; env: StripeEnv }
  | { configured: false; missing: string[] } {
  const secretKey = process.env.STRIPE_SECRET_KEY
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  const priceId = process.env.STRIPE_PRO_PRICE_ID

  const missing: string[] = []
  if (!secretKey) missing.push("STRIPE_SECRET_KEY")
  if (!webhookSecret) missing.push("STRIPE_WEBHOOK_SECRET")
  if (!priceId) missing.push("STRIPE_PRO_PRICE_ID")
  // Catch the easy mistake of pasting a Product ID (`prod_...`) instead of a
  // Price ID (`price_...`) — Stripe Checkout requires the latter.
  if (priceId && !priceId.startsWith("price_")) {
    missing.push("STRIPE_PRO_PRICE_ID (must start with 'price_', not 'prod_')")
  }

  if (missing.length > 0) return { configured: false, missing }
  return {
    configured: true,
    env: {
      secretKey: secretKey!,
      webhookSecret: webhookSecret!,
      priceId: priceId!,
    },
  }
}

export const STRIPE_SETUP_MESSAGE =
  "Stripe is not configured. Set STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, and STRIPE_PRO_PRICE_ID in .env.local."

/**
 * True when the configured Stripe key is a test-mode key. Used to surface
 * the Stripe test card numbers on the billing page (so portfolio visitors
 * can try the upgrade flow without entering a real card). Stripe encodes
 * the mode in the key prefix: `sk_test_…` → sandbox, `sk_live_…` → real.
 * Auto-disappears when the operator swaps to a live key.
 */
export function isStripeTestMode(): boolean {
  const key = process.env.STRIPE_SECRET_KEY ?? ""
  return key.startsWith("sk_test_")
}

export const PRO_PLAN = {
  name: "Pro",
  priceMonthly: 19,
  features: [
    "Unlimited AI-classified emails",
    "Unlimited daily summaries",
    "AI draft replies with tone control",
    "Priority support",
  ],
} as const

export const FREE_PLAN = {
  name: "Free",
  priceMonthly: 0,
  features: [
    "10 AI-classified emails per day",
    "Daily inbox summary",
    "Basic categorization",
    "Email + Google sign-in",
  ],
} as const
