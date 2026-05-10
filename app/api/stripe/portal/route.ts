import { NextResponse, type NextRequest } from "next/server"
import { readStripeEnv, STRIPE_SETUP_MESSAGE } from "@/lib/stripe/env"
import { createStripeClient } from "@/lib/stripe/client"
import { createClient } from "@/lib/supabase/server"

/**
 * POST /api/stripe/portal
 * Redirects the user to a Stripe Customer Portal session for managing
 * their subscription (cancel, update payment method, view invoices).
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
  const session = await stripe.billingPortal.sessions.create({
    customer: profile.stripe_customer_id,
    return_url: `${origin}/dashboard/billing`,
  })

  return NextResponse.redirect(session.url, { status: 303 })
}
