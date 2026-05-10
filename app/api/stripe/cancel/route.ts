import { NextResponse, type NextRequest } from "next/server"
import { createStripeClient } from "@/lib/stripe/client"
import { readStripeEnv, STRIPE_SETUP_MESSAGE } from "@/lib/stripe/env"
import { pickPrimarySubscription } from "@/lib/stripe/subscription"
import { createClient } from "@/lib/supabase/server"

/**
 * POST /api/stripe/cancel
 * Schedules cancellation of the user's active subscription at the end of the
 * current period (`cancel_at_period_end = true`). The webhook will mirror the
 * change to `profiles`; we also write optimistically here so the UI reflects
 * the cancellation immediately on the next render.
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
  if (!sub) {
    return NextResponse.redirect(
      new URL("/dashboard/billing?stripe_error=no_subscription", origin),
      { status: 303 }
    )
  }

  if (sub.cancel_at_period_end) {
    return NextResponse.redirect(
      new URL("/dashboard/billing?stripe=already_cancelled", origin),
      { status: 303 }
    )
  }

  await stripe.subscriptions.update(sub.id, { cancel_at_period_end: true })

  // Optimistic local update — webhook delivers the canonical state shortly.
  await supabase
    .from("profiles")
    .update({ cancel_at_period_end: true })
    .eq("id", user.id)

  return NextResponse.redirect(
    new URL("/dashboard/billing?stripe=cancel_scheduled", origin),
    { status: 303 }
  )
}
