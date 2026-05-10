import { NextResponse, type NextRequest } from "next/server"
import { readStripeEnv, STRIPE_SETUP_MESSAGE } from "@/lib/stripe/env"
import { createStripeClient } from "@/lib/stripe/client"
import { createClient } from "@/lib/supabase/server"

/**
 * POST /api/stripe/checkout
 * Creates a Stripe Checkout Session for the InboxIQ Pro subscription and
 * 303-redirects the browser to Stripe's hosted checkout page.
 *
 * Submitted from a `<form method="POST" action="/api/stripe/checkout">`.
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

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("stripe_customer_id, plan, email")
    .eq("id", user.id)
    .maybeSingle()
  if (profileError) {
    console.error("[stripe] profile read failed:", profileError)
    return NextResponse.redirect(
      new URL("/dashboard/billing?stripe_error=profile_lookup_failed", origin),
      { status: 303 }
    )
  }

  if (profile?.plan === "pro") {
    return NextResponse.redirect(
      new URL("/dashboard/billing?stripe=already_pro", origin),
      { status: 303 }
    )
  }

  const stripe = createStripeClient()

  // Reuse an existing customer if we already created one.
  let customerId = profile?.stripe_customer_id ?? null
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email ?? profile?.email ?? undefined,
      metadata: { userId: user.id },
    })
    customerId = customer.id

    // Upsert (not update) so users who signed up before the handle_new_user
    // trigger was in place still get a profile row. RLS allows auth.uid() = id.
    const { error: upsertError } = await supabase
      .from("profiles")
      .upsert(
        {
          id: user.id,
          email: user.email ?? profile?.email ?? "",
          stripe_customer_id: customerId,
        },
        { onConflict: "id" }
      )
    if (upsertError) {
      console.error("[stripe] profile upsert failed:", upsertError)
    }
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    client_reference_id: user.id,
    line_items: [{ price: cfg.env.priceId, quantity: 1 }],
    success_url: `${origin}/dashboard/billing?stripe=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/dashboard/billing?stripe=cancelled`,
    allow_promotion_codes: true,
    subscription_data: {
      metadata: { userId: user.id },
    },
  })

  if (!session.url) {
    console.error("[stripe] checkout session has no url:", session.id)
    return NextResponse.redirect(
      new URL("/dashboard/billing?stripe_error=no_session_url", origin),
      { status: 303 }
    )
  }

  return NextResponse.redirect(session.url, { status: 303 })
}
