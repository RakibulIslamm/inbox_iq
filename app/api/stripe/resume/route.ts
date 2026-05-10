import { NextResponse, type NextRequest } from "next/server"
import { createStripeClient } from "@/lib/stripe/client"
import { readStripeEnv, STRIPE_SETUP_MESSAGE } from "@/lib/stripe/env"
import { pickPrimarySubscription } from "@/lib/stripe/subscription"
import { createClient } from "@/lib/supabase/server"

/**
 * POST /api/stripe/resume
 * Reverses a scheduled cancellation by setting `cancel_at_period_end = false`
 * on the user's subscription. Only valid while the period hasn't ended yet —
 * once Stripe finalizes the cancellation the subscription is gone and the
 * user must subscribe again (Checkout flow).
 */
export async function POST(request: NextRequest) {
  const { origin } = new URL(request.url)

  const cfg = readStripeEnv()
  if (!cfg.configured) {
    return NextResponse.redirect(
      new URL(
        `/dashboard/billing?stripe_error=${encodeURIComponent(STRIPE_SETUP_MESSAGE)}`,
        origin
      ),
      { status: 303 }
    )
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(new URL("/login", origin), { status: 303 })
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .maybeSingle()

  if (!profile?.stripe_customer_id) {
    return NextResponse.redirect(
      new URL("/dashboard/billing?stripe_error=no_customer", origin),
      { status: 303 }
    )
  }

  const stripe = createStripeClient()
  const subs = await stripe.subscriptions.list({
    customer: profile.stripe_customer_id,
    status: "all",
    limit: 10,
  })
  const sub = pickPrimarySubscription(subs.data)
  // A cancellation is "pending" if EITHER signal is set — see notes in
  // lib/stripe/subscription.ts. Without checking both, the Stripe Customer
  // Portal's cancel-at-timestamp flow goes undetected here.
  const isPending =
    sub != null &&
    (Boolean(sub.cancel_at_period_end) || sub.cancel_at !== null)
  if (!sub || !isPending) {
    return NextResponse.redirect(
      new URL("/dashboard/billing?stripe_error=no_cancellable_subscription", origin),
      { status: 303 }
    )
  }

  // Stripe rejects passing both `cancel_at_period_end` and `cancel_at` in
  // a single update — they're mutually exclusive. Only one can be set on
  // a sub at a time, so unset the one that's actually set:
  //   - In-app cancel uses `cancel_at_period_end: true`  → unset that.
  //   - Customer Portal cancel uses `cancel_at: <unix>`  → unset that.
  const resumeParams = sub.cancel_at_period_end
    ? { cancel_at_period_end: false as const }
    : { cancel_at: null }
  await stripe.subscriptions.update(sub.id, resumeParams)

  await supabase
    .from("profiles")
    .update({ cancel_at_period_end: false })
    .eq("id", user.id)

  return NextResponse.redirect(
    new URL("/dashboard/billing?stripe=resumed", origin),
    { status: 303 }
  )
}
