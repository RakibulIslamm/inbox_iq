import type Stripe from "stripe"

/**
 * Pick the subscription that best matches what the Stripe Customer Portal
 * displays under "Current subscription". Used by every code path that needs
 * to act on or display the user's "current" subscription so they all agree.
 *
 * Rules:
 *   1. Drop terminal rows (canceled / incomplete_expired) entirely.
 *   2. Among the remaining, prefer active / trialing / past_due.
 *   3. If multiple are active, prefer the one with a pending cancellation —
 *      that's the row the portal shows under "Cancels on …" and it's the
 *      actionable state for the user.
 *   4. Otherwise fall back to the *oldest* (the original subscription),
 *      not the newest — newer rows are usually re-subscribe tests that
 *      don't reflect the user's mental model.
 */
export function pickPrimarySubscription(
  subs: Stripe.Subscription[]
): Stripe.Subscription | null {
  const ranked = [...subs]
    .filter(
      (s) => s.status !== "canceled" && s.status !== "incomplete_expired"
    )
    .sort((a, b) => {
      const liveOrder = (s: Stripe.Subscription) =>
        s.status === "active" ||
        s.status === "trialing" ||
        s.status === "past_due"
          ? 0
          : 1
      if (liveOrder(a) !== liveOrder(b)) return liveOrder(a) - liveOrder(b)

      const cancelOrder = (s: Stripe.Subscription) =>
        s.cancel_at_period_end ? 0 : 1
      if (cancelOrder(a) !== cancelOrder(b))
        return cancelOrder(a) - cancelOrder(b)

      return (a.created ?? 0) - (b.created ?? 0)
    })
  return ranked[0] ?? null
}

/** Profile columns we cache from a Stripe.Subscription. */
export type SubscriptionState = {
  plan: "free" | "pro"
  subscription_status: string
  /**
   * True when the subscription is scheduled to cancel — either via the
   * `cancel_at_period_end` boolean OR a future `cancel_at` timestamp. The
   * Stripe Customer Portal cancels via the latter and leaves the boolean
   * false, so we OR them together. The column name is kept for backward
   * compat but the semantics are now "is cancelling".
   */
  cancel_at_period_end: boolean
  /**
   * When the subscription will lapse. If a cancellation is scheduled this
   * is `cancel_at`; otherwise it's the current billing period end. Used for
   * the "ends Jun 9" / "renews Jun 9" date in the UI.
   */
  current_period_end: string | null
}

/**
 * Read the bits of a Stripe Subscription we persist on `profiles`.
 *
 * NOTE on `current_period_end`: in Stripe's 2025+ API the period boundaries
 * moved from the Subscription to each SubscriptionItem. We have one item per
 * subscription (the Pro price), so reading from `items.data[0]` is correct.
 */
export function extractSubscriptionState(
  sub: Stripe.Subscription
): SubscriptionState {
  const periodEndUnix = sub.items.data[0]?.current_period_end ?? null
  const cancelAtUnix = sub.cancel_at ?? null
  // Treat the subscription as cancelling if EITHER signal is set. Stripe's
  // Customer Portal expresses cancellation via `cancel_at` (a future
  // timestamp) and leaves `cancel_at_period_end` at false, so we have to
  // OR them together to detect the cancelled state correctly.
  const isCancelling = (sub.cancel_at_period_end ?? false) || cancelAtUnix !== null
  // When cancelling, `cancel_at` is the truthful end date — that's the value
  // the portal renders as "Cancels Jun 9". Otherwise use the period boundary.
  const endUnix = cancelAtUnix ?? periodEndUnix
  return {
    plan: subscriptionIsActive(sub.status) ? "pro" : "free",
    subscription_status: sub.status,
    cancel_at_period_end: isCancelling,
    current_period_end: endUnix
      ? new Date(endUnix * 1000).toISOString()
      : null,
  }
}

export function subscriptionIsActive(
  status: Stripe.Subscription.Status
): boolean {
  // 'active' = paying. 'trialing' = inside a trial. 'past_due' still has
  // access while Stripe retries — keep them on Pro until canceled.
  return status === "active" || status === "trialing" || status === "past_due"
}
