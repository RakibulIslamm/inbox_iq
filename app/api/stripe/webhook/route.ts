import { NextResponse, type NextRequest } from "next/server"
import type Stripe from "stripe"
import { createStripeClient } from "@/lib/stripe/client"
import { readStripeEnv } from "@/lib/stripe/env"
import { createAdminClient } from "@/lib/supabase/admin"

/**
 * POST /api/stripe/webhook
 *
 * Stripe POSTs subscription lifecycle events here. We verify the signature
 * with the webhook secret and use the service-role Supabase client to update
 * `profiles.plan` (the webhook isn't authenticated as a Supabase user).
 *
 * Events handled:
 *   - checkout.session.completed       → mark plan = 'pro', persist customer id
 *   - customer.subscription.updated    → plan tracks subscription.status
 *   - customer.subscription.deleted    → plan = 'free'
 */
export async function POST(request: NextRequest) {
  const cfg = readStripeEnv()
  if (!cfg.configured) {
    return new Response("Stripe is not configured.", { status: 500 })
  }

  const sig = request.headers.get("stripe-signature")
  if (!sig) {
    return new Response("Missing stripe-signature header.", { status: 400 })
  }

  // Webhook signing requires the *raw* request body — never JSON.parse first.
  const rawBody = await request.text()
  const stripe = createStripeClient()

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, cfg.env.webhookSecret)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[stripe] webhook signature failed:", msg)
    return new Response(`Webhook signature failed: ${msg}`, { status: 400 })
  }

  const admin = createAdminClient()

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object, admin, stripe)
        break
      case "customer.subscription.updated":
      case "customer.subscription.created":
        await handleSubscriptionChange(event.data.object, admin)
        break
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object, admin)
        break
      default:
        // Other events (invoice.paid etc.) are accepted but no-op.
        break
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error(`[stripe] handler failed for ${event.type}:`, msg)
    // Return 500 so Stripe retries.
    return new Response(`Handler failed: ${msg}`, { status: 500 })
  }

  return NextResponse.json({ received: true })
}

async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session,
  admin: ReturnType<typeof createAdminClient>,
  stripe: Stripe
) {
  const userId =
    session.client_reference_id ??
    (typeof session.metadata?.userId === "string" ? session.metadata.userId : null)
  if (!userId) {
    console.error("[stripe] checkout.session.completed missing userId reference")
    return
  }

  const customerId =
    typeof session.customer === "string" ? session.customer : session.customer?.id
  if (!customerId) {
    console.error("[stripe] checkout.session.completed missing customer")
    return
  }

  // Pull the subscription to read its status — checkout sometimes returns
  // before the subscription is fully provisioned, so default to 'pro' optimistically.
  let plan: "free" | "pro" = "pro"
  if (session.subscription) {
    const subscriptionId =
      typeof session.subscription === "string"
        ? session.subscription
        : session.subscription.id
    try {
      const sub = await stripe.subscriptions.retrieve(subscriptionId)
      plan = subscriptionIsActive(sub.status) ? "pro" : "free"
    } catch (e) {
      console.warn("[stripe] could not retrieve subscription, defaulting to pro:", e)
    }
  }

  const { error } = await admin
    .from("profiles")
    .update({ plan, stripe_customer_id: customerId })
    .eq("id", userId)
  if (error) {
    throw new Error(`profiles update failed: ${error.message}`)
  }
}

async function handleSubscriptionChange(
  subscription: Stripe.Subscription,
  admin: ReturnType<typeof createAdminClient>
) {
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id

  const plan: "free" | "pro" = subscriptionIsActive(subscription.status)
    ? "pro"
    : "free"

  const { error } = await admin
    .from("profiles")
    .update({ plan })
    .eq("stripe_customer_id", customerId)
  if (error) {
    throw new Error(`profiles update failed: ${error.message}`)
  }
}

async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription,
  admin: ReturnType<typeof createAdminClient>
) {
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id

  const { error } = await admin
    .from("profiles")
    .update({ plan: "free" })
    .eq("stripe_customer_id", customerId)
  if (error) {
    throw new Error(`profiles update failed: ${error.message}`)
  }
}

function subscriptionIsActive(status: Stripe.Subscription.Status): boolean {
  // 'active' = paying. 'trialing' = inside a trial. 'past_due' still has
  // access while Stripe retries — we keep them on Pro until canceled.
  return status === "active" || status === "trialing" || status === "past_due"
}
