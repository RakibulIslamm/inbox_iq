import type { Metadata } from "next"
import type Stripe from "stripe"
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  CreditCard,
  FlaskConical,
  Receipt,
  Sparkles,
} from "lucide-react"

export const metadata: Metadata = { title: "Billing" }
// Always render fresh — we fetch live subscription state from Stripe on each
// load and don't want any Next.js or fetch caching layer to serve a stale
// snapshot (e.g., showing "Renews on" right after a cancellation).
export const dynamic = "force-dynamic"
export const revalidate = 0

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { createStripeClient } from "@/lib/stripe/client"
import {
  FREE_PLAN,
  isStripeTestMode,
  PRO_PLAN,
  readStripeEnv,
} from "@/lib/stripe/env"
import {
  extractSubscriptionState,
  pickPrimarySubscription,
} from "@/lib/stripe/subscription"
import { createClient } from "@/lib/supabase/server"

type SearchParams = Promise<{
  stripe?: string
  stripe_error?: string
  debug?: string
}>

type DebugInfo = {
  customerId: string | null
  picked: string | null
  subs: Array<{
    id: string
    status: string
    cancel_at_period_end: boolean
    cancel_at: number | null
    current_period_end: number | null
    created: number
  }>
  profile: {
    plan: string | null
    subscription_status: string | null
    cancel_at_period_end: boolean | null
    current_period_end: string | null
  }
} | null

const STATUS_MESSAGES: Record<
  string,
  { tone: "success" | "error"; text: string }
> = {
  success: { tone: "success", text: "You're on Pro. Welcome aboard." },
  cancelled: {
    tone: "error",
    text: "Checkout was cancelled. You can try again any time.",
  },
  already_pro: { tone: "success", text: "You're already on the Pro plan." },
  cancel_scheduled: {
    tone: "success",
    text: "Cancellation scheduled. You keep Pro access until the end of the current period.",
  },
  already_cancelled: {
    tone: "success",
    text: "Subscription is already scheduled to cancel.",
  },
  resumed: {
    tone: "success",
    text: "Subscription resumed — your plan will renew normally.",
  },
}

const ERROR_MESSAGES: Record<string, string> = {
  no_customer:
    "We don't have a Stripe customer on file yet. Click Upgrade to start a subscription.",
  no_session_url:
    "Stripe didn't return a checkout URL. Try again, or check the server logs.",
  no_subscription:
    "Couldn't find an active subscription to cancel.",
  no_cancellable_subscription:
    "No subscription is currently scheduled to cancel.",
  profile_lookup_failed: "Couldn't read your profile. Try refreshing.",
}

type PaymentMethodInfo = {
  brand: string
  last4: string
  expMonth: number | null
  expYear: number | null
} | null

type InvoiceRow = {
  id: string
  number: string | null
  amountDueCents: number | null
  currency: string
  status: Stripe.Invoice.Status | null
  createdUnix: number | null
  pdfUrl: string | null
  hostedUrl: string | null
}

export default async function BillingPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const params = await searchParams
  const stripeCfg = readStripeEnv()

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "plan, stripe_customer_id, subscription_status, cancel_at_period_end, current_period_end"
    )
    .eq("id", user.id)
    .maybeSingle()

  const hasCustomer = Boolean(profile?.stripe_customer_id)
  const showDebug = params.debug === "1"
  let debug: DebugInfo = null

  // Pull payment method + invoices + the live subscription from Stripe at
  // page render. Live subscription data wins over the cached profile columns
  // because the webhook can be delayed (or never fires in local dev without
  // `stripe listen`). Each call is best-effort: failures degrade silently.
  let paymentMethod: PaymentMethodInfo = null
  let invoices: InvoiceRow[] = []
  let liveSub: Stripe.Subscription | null = null
  if (stripeCfg.configured && profile?.stripe_customer_id) {
    const stripe = createStripeClient()
    const [customerRes, invoicesRes, subsRes] = await Promise.allSettled([
      stripe.customers.retrieve(profile.stripe_customer_id, {
        expand: ["invoice_settings.default_payment_method"],
      }),
      stripe.invoices.list({
        customer: profile.stripe_customer_id,
        limit: 5,
      }),
      stripe.subscriptions.list({
        customer: profile.stripe_customer_id,
        status: "all",
        limit: 5,
      }),
    ])

    if (customerRes.status === "fulfilled" && !customerRes.value.deleted) {
      const customer = customerRes.value as Stripe.Customer
      const pm = customer.invoice_settings.default_payment_method
      if (pm && typeof pm !== "string" && pm.card) {
        paymentMethod = {
          brand: pm.card.brand,
          last4: pm.card.last4,
          expMonth: pm.card.exp_month,
          expYear: pm.card.exp_year,
        }
      }
    } else if (customerRes.status === "rejected") {
      console.warn(
        "[stripe] could not retrieve customer:",
        customerRes.reason
      )
    }

    if (invoicesRes.status === "fulfilled") {
      invoices = invoicesRes.value.data.map((inv) => ({
        id: inv.id ?? "",
        number: inv.number ?? null,
        amountDueCents: inv.amount_due ?? null,
        currency: inv.currency,
        status: inv.status,
        createdUnix: inv.created ?? null,
        pdfUrl: inv.invoice_pdf ?? null,
        hostedUrl: inv.hosted_invoice_url ?? null,
      }))
    } else if (invoicesRes.status === "rejected") {
      console.warn(
        "[stripe] could not list invoices:",
        invoicesRes.reason
      )
    }

    if (subsRes.status === "fulfilled") {
      liveSub = pickPrimarySubscription(subsRes.value.data)
      const subSummaries = subsRes.value.data.map((s) => ({
        id: s.id,
        status: s.status,
        cancel_at_period_end: s.cancel_at_period_end,
        cancel_at: s.cancel_at,
        current_period_end: s.items.data[0]?.current_period_end ?? null,
        created: s.created,
      }))
      if (showDebug) {
        debug = {
          customerId: profile.stripe_customer_id,
          picked: liveSub?.id ?? null,
          subs: subSummaries,
          profile: {
            plan: profile.plan ?? null,
            subscription_status:
              (profile.subscription_status as string | null) ?? null,
            cancel_at_period_end:
              (profile.cancel_at_period_end as boolean | null) ?? null,
            current_period_end:
              (profile.current_period_end as string | null) ?? null,
          },
        }
      }
    } else if (subsRes.status === "rejected") {
      console.warn("[stripe] could not list subscriptions:", subsRes.reason)
      if (showDebug) {
        debug = {
          customerId: profile.stripe_customer_id,
          picked: null,
          subs: [],
          profile: {
            plan: profile.plan ?? null,
            subscription_status:
              (profile.subscription_status as string | null) ?? null,
            cancel_at_period_end:
              (profile.cancel_at_period_end as boolean | null) ?? null,
            current_period_end:
              (profile.current_period_end as string | null) ?? null,
          },
        }
      }
    }
  }

  // Lazy reconcile: if we got live state, write it back to `profiles` so the
  // DB cache stays in sync even when the webhook isn't running locally.
  // Best-effort — failures here just leave the cache stale, the page render
  // doesn't depend on this write.
  if (liveSub) {
    const next = extractSubscriptionState(liveSub)
    if (
      next.subscription_status !== (profile?.subscription_status ?? null) ||
      next.cancel_at_period_end !== Boolean(profile?.cancel_at_period_end) ||
      next.current_period_end !==
        (profile?.current_period_end
          ? new Date(profile.current_period_end as string).toISOString()
          : null) ||
      next.plan !== (profile?.plan ?? "free")
    ) {
      const { error: reconcileErr } = await supabase
        .from("profiles")
        .update(next)
        .eq("id", user.id)
      if (reconcileErr) {
        console.warn("[stripe] reconcile profile failed:", reconcileErr.message)
      }
    }
  }

  // Live Stripe state is authoritative — derive everything via the shared
  // helper so the billing page, the webhook, and the lazy reconciler agree
  // on what "cancelling" means (cancel_at_period_end OR cancel_at set).
  // Only fall back to the cached profile columns when Stripe is unreachable.
  const liveState = liveSub ? extractSubscriptionState(liveSub) : null
  const subStatus = liveState
    ? liveState.subscription_status
    : ((profile?.subscription_status as string | null) ?? null)
  const cancelAtPeriodEnd = liveState
    ? liveState.cancel_at_period_end
    : Boolean(profile?.cancel_at_period_end)
  const currentPeriodEnd = liveState?.current_period_end
    ? new Date(liveState.current_period_end)
    : profile?.current_period_end
      ? new Date(profile.current_period_end as string)
      : null

  const liveIsActive =
    subStatus === "active" ||
    subStatus === "trialing" ||
    subStatus === "past_due"
  const plan: "free" | "pro" =
    liveIsActive || profile?.plan === "pro" ? "pro" : "free"
  const canCancelInApp = Boolean(
    plan === "pro" && hasCustomer && stripeCfg.configured && liveSub && !cancelAtPeriodEnd
  )
  const canResumeInApp = Boolean(
    plan === "pro" && hasCustomer && stripeCfg.configured && liveSub && cancelAtPeriodEnd
  )
  // Server component renders fresh per request, so reading the wall clock
  // here is fine — the purity rule flags it as if this were a client render.
  // eslint-disable-next-line react-hooks/purity
  const nowMs = Date.now()
  const daysRemaining = currentPeriodEnd
    ? Math.max(
        0,
        Math.ceil((currentPeriodEnd.getTime() - nowMs) / (1000 * 60 * 60 * 24))
      )
    : null

  const status = params.stripe ? STATUS_MESSAGES[params.stripe] : null
  const errorRaw = params.stripe_error
  const errorText = errorRaw ? ERROR_MESSAGES[errorRaw] ?? errorRaw : null

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-8">
      <div className="space-y-1">
        <h1 className="text-sm font-medium">Billing</h1>
        <p className="text-xs text-muted-foreground">
          Manage your InboxIQ subscription.
        </p>
      </div>

      {status ? (
        <StatusBanner tone={status.tone} message={status.text} />
      ) : null}
      {errorText ? <StatusBanner tone="error" message={errorText} /> : null}

      {!stripeCfg.configured ? (
        <Card>
          <CardHeader>
            <AlertTriangle className="size-4 text-destructive" />
            <CardTitle className="mt-2">Stripe is not configured</CardTitle>
            <CardDescription>
              Missing env:{" "}
              {stripeCfg.missing.map((m) => (
                <code key={m} className="mx-1 rounded bg-muted px-1">
                  {m}
                </code>
              ))}
              . See the README for the Phase 5 setup.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {debug ? <DebugPanel debug={debug} /> : null}

      <SubscriptionStateBanner
        plan={plan}
        subscriptionStatus={subStatus}
        cancelAtPeriodEnd={cancelAtPeriodEnd}
        currentPeriodEnd={currentPeriodEnd}
        daysRemaining={daysRemaining}
        canCancelInApp={canCancelInApp}
        canResumeInApp={canResumeInApp}
      />

      {/* Current plan summary */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Current plan</CardTitle>
            <Badge
              variant="outline"
              className={cn(
                "uppercase",
                plan === "pro"
                  ? "border-foreground/40 text-foreground"
                  : "border-muted-foreground/30 text-muted-foreground"
              )}
            >
              {plan}
            </Badge>
          </div>
          <CardDescription>
            {plan === "pro"
              ? "Unlimited AI processing, summaries, and draft replies."
              : "Free tier — 10 AI-classified emails per day."}
          </CardDescription>
        </CardHeader>
        {plan === "pro" && hasCustomer && stripeCfg.configured ? (
          <CardContent>
            <div className="flex flex-wrap items-center gap-2">
              <form method="POST" action="/api/stripe/portal">
                <Button type="submit" variant="outline">
                  Manage subscription
                </Button>
              </form>
              {canCancelInApp ? (
                <form method="POST" action="/api/stripe/cancel">
                  <Button type="submit" variant="outline">
                    Cancel subscription
                  </Button>
                </form>
              ) : null}
              {canResumeInApp ? (
                <form method="POST" action="/api/stripe/resume">
                  <Button type="submit">Don&apos;t cancel</Button>
                </form>
              ) : null}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {canResumeInApp
                ? "Subscription is set to cancel — click “Don’t cancel” to keep it active."
                : "Update payment method, download invoices, or cancel without leaving the app."}
            </p>
          </CardContent>
        ) : null}
      </Card>

      {stripeCfg.configured && isStripeTestMode() ? <TestCardsCard /> : null}

      {/* Plans comparison */}
      <div className="grid gap-4 md:grid-cols-2">
        <PlanCard
          plan="free"
          active={plan === "free"}
          stripeConfigured={stripeCfg.configured}
        />
        <PlanCard
          plan="pro"
          active={plan === "pro"}
          stripeConfigured={stripeCfg.configured}
        />
      </div>

      {paymentMethod ? <PaymentMethodCard pm={paymentMethod} /> : null}
      {invoices.length > 0 ? <InvoicesCard invoices={invoices} /> : null}
    </div>
  )
}

function DebugPanel({ debug }: { debug: NonNullable<DebugInfo> }) {
  return (
    <Card className="border-amber-500/40 bg-amber-500/5">
      <CardHeader>
        <CardTitle>Debug · raw Stripe + DB state</CardTitle>
        <CardDescription>
          Visible because of <code>?debug=1</code>. Compare these values to
          what the Stripe Customer Portal shows.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <pre className="overflow-x-auto text-[10px] leading-relaxed">
{JSON.stringify(debug, null, 2)}
        </pre>
      </CardContent>
    </Card>
  )
}

function StatusBanner({
  tone,
  message,
}: {
  tone: "success" | "error"
  message: string
}) {
  const Icon = tone === "success" ? CheckCircle2 : AlertTriangle
  const className =
    tone === "success"
      ? "border-foreground/20 text-foreground"
      : "border-destructive/40 text-destructive"
  return (
    <div
      className={cn(
        "flex items-start gap-2 border px-3 py-2 text-xs",
        className
      )}
    >
      <Icon className="mt-0.5 size-3.5 shrink-0" />
      <span>{message}</span>
    </div>
  )
}

function SubscriptionStateBanner({
  plan,
  subscriptionStatus,
  cancelAtPeriodEnd,
  currentPeriodEnd,
  daysRemaining,
  canResumeInApp,
}: {
  plan: "free" | "pro"
  subscriptionStatus: string | null
  cancelAtPeriodEnd: boolean
  currentPeriodEnd: Date | null
  daysRemaining: number | null
  canCancelInApp: boolean
  canResumeInApp: boolean
}) {
  // Past-due — payment failed, prompt the user to fix their card.
  if (subscriptionStatus === "past_due") {
    return (
      <div className="flex items-start gap-2 border border-destructive/40 px-3 py-2 text-xs text-destructive">
        <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
        <span>
          Payment failed. Update your card from <strong>Manage subscription</strong>{" "}
          before access drops to Free.
        </span>
      </div>
    )
  }

  // Pro is scheduled to cancel — warning tone + "Don't cancel" CTA.
  if (plan === "pro" && cancelAtPeriodEnd && currentPeriodEnd) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
        <div className="flex min-w-0 items-start gap-2">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          <span>
            <strong>Subscription cancelled.</strong>{" "}
            {daysRemaining != null ? (
              <>
                <strong>
                  {daysRemaining} {daysRemaining === 1 ? "day" : "days"} remaining
                </strong>{" "}
                · ends {formatDate(currentPeriodEnd)}.
              </>
            ) : (
              <>Ends {formatDate(currentPeriodEnd)}.</>
            )}
          </span>
        </div>
        {canResumeInApp ? (
          <form method="POST" action="/api/stripe/resume" className="shrink-0">
            <Button type="submit" size="sm">
              Don&apos;t cancel
            </Button>
          </form>
        ) : null}
      </div>
    )
  }

  // Pro and renewing.
  if (plan === "pro" && !cancelAtPeriodEnd && currentPeriodEnd) {
    return (
      <div className="flex items-start gap-2 border border-border px-3 py-2 text-xs text-muted-foreground">
        <CalendarClock className="mt-0.5 size-3.5 shrink-0" />
        <span>
          Renews on <strong>{formatDate(currentPeriodEnd)}</strong>
          {daysRemaining != null
            ? ` · ${daysRemaining} ${daysRemaining === 1 ? "day" : "days"} remaining`
            : ""}
          .
        </span>
      </div>
    )
  }

  return null
}

/**
 * Visible only when STRIPE_SECRET_KEY is a sandbox key (`sk_test_…`). Surfaces
 * Stripe's documented test card numbers so portfolio visitors can drive the
 * Pro upgrade flow end-to-end without entering real card details.
 *
 * Auto-disappears the moment the operator swaps to a live key — `isStripeTestMode()`
 * reads the prefix at request time.
 *
 * Test card reference: https://docs.stripe.com/testing
 */
function TestCardsCard() {
  const cards: Array<{
    label: string
    number: string
    note: string
    tone: "success" | "warn" | "error"
  }> = [
    {
      label: "Successful payment",
      number: "4242 4242 4242 4242",
      note: "Use this for the happy-path upgrade flow.",
      tone: "success",
    },
    {
      label: "Requires authentication (3D Secure)",
      number: "4000 0027 6000 3184",
      note: "Triggers Stripe's authentication challenge.",
      tone: "warn",
    },
    {
      label: "Card declined",
      number: "4000 0000 0000 0002",
      note: "Stripe will reject the charge — useful for testing failure UX.",
      tone: "error",
    },
  ]

  const toneClass = (tone: "success" | "warn" | "error") =>
    tone === "success"
      ? "border-foreground/30"
      : tone === "warn"
        ? "border-amber-500/40 text-amber-700 dark:text-amber-400"
        : "border-destructive/40 text-destructive"

  return (
    <Card className="border-amber-500/40 bg-amber-500/5">
      <CardHeader>
        <div className="flex items-center gap-2">
          <FlaskConical className="size-4 text-amber-700 dark:text-amber-400" />
          <CardTitle>Test mode · use a Stripe test card</CardTitle>
        </div>
        <CardDescription>
          This deployment runs against Stripe&apos;s sandbox. Real cards are
          rejected — pick one of the numbers below to drive the upgrade
          flow. Use any future expiry, any 3-digit CVC, and any postal code.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        <ul className="divide-y divide-border border-y border-border">
          {cards.map((c) => (
            <li
              key={c.number}
              className="flex flex-wrap items-center gap-3 px-4 py-3 text-xs"
            >
              <code className="rounded bg-muted px-2 py-1 font-mono text-[11px] tabular-nums tracking-wider">
                {c.number}
              </code>
              <Badge variant="outline" className={cn("uppercase", toneClass(c.tone))}>
                {c.label}
              </Badge>
              <span className="text-muted-foreground">{c.note}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

function PaymentMethodCard({ pm }: { pm: NonNullable<PaymentMethodInfo> }) {
  const expiry =
    pm.expMonth && pm.expYear
      ? `${String(pm.expMonth).padStart(2, "0")}/${String(pm.expYear).slice(-2)}`
      : null
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CreditCard className="size-4" />
          <CardTitle>Payment method</CardTitle>
        </div>
        <CardDescription>
          {capitalize(pm.brand)} •••• {pm.last4}
          {expiry ? ` · expires ${expiry}` : ""}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form method="POST" action="/api/stripe/portal">
          <Button type="submit" variant="outline" size="sm">
            Update card
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

function InvoicesCard({ invoices }: { invoices: InvoiceRow[] }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Receipt className="size-4" />
          <CardTitle>Recent invoices</CardTitle>
        </div>
        <CardDescription>Last {invoices.length} invoice(s).</CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        <ul className="divide-y divide-border border-y border-border">
          {invoices.map((inv) => (
            <li
              key={inv.id}
              className="flex items-center gap-3 px-4 py-3 text-xs"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {inv.number ?? inv.id.slice(0, 12)}
                </p>
                <p className="text-muted-foreground">
                  {inv.createdUnix
                    ? formatDate(new Date(inv.createdUnix * 1000))
                    : "—"}
                </p>
              </div>
              <span className="tabular-nums">
                {inv.amountDueCents != null
                  ? formatMoney(inv.amountDueCents, inv.currency)
                  : "—"}
              </span>
              {inv.status ? (
                <Badge
                  variant="outline"
                  className={cn(
                    "uppercase",
                    inv.status === "paid"
                      ? "border-foreground/30"
                      : "border-muted-foreground/30 text-muted-foreground"
                  )}
                >
                  {inv.status}
                </Badge>
              ) : null}
              {inv.pdfUrl || inv.hostedUrl ? (
                <a
                  href={inv.pdfUrl ?? inv.hostedUrl ?? "#"}
                  target="_blank"
                  rel="noreferrer"
                  className="text-muted-foreground hover:text-foreground"
                >
                  PDF →
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

function PlanCard({
  plan,
  active,
  stripeConfigured,
}: {
  plan: "free" | "pro"
  active: boolean
  stripeConfigured: boolean
}) {
  const data = plan === "pro" ? PRO_PLAN : FREE_PLAN
  const isPro = plan === "pro"
  return (
    <Card className={isPro ? "ring-2 ring-foreground" : undefined}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{data.name}</CardTitle>
          {active ? <Badge>Current plan</Badge> : null}
        </div>
        <div className="mt-3 flex items-baseline gap-1">
          <span className="font-heading text-3xl">${data.priceMonthly}</span>
          <span className="text-xs text-muted-foreground">/mo</span>
        </div>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {data.features.map((f) => (
            <li key={f} className="flex items-start gap-2 text-xs">
              <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" />
              <span>{f}</span>
            </li>
          ))}
        </ul>
        {isPro && !active ? (
          <form
            method="POST"
            action="/api/stripe/checkout"
            className="mt-5"
          >
            <Button
              type="submit"
              disabled={!stripeConfigured}
              className="w-full"
            >
              <Sparkles className="size-3.5" />
              Upgrade to Pro
            </Button>
            {!stripeConfigured ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Stripe must be configured before checkout works.
              </p>
            ) : null}
          </form>
        ) : null}
      </CardContent>
    </Card>
  )
}

function formatDate(d: Date): string {
  // Render in UTC so the date matches what Stripe shows in Portal,
  // invoice emails, and receipts. Otherwise a 19:48 UTC timestamp
  // looks like "Jun 10" to a user in UTC+6 even though Stripe says "Jun 9".
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  })
}

function formatMoney(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency.toUpperCase(),
      minimumFractionDigits: 2,
    }).format(cents / 100)
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency.toUpperCase()}`
  }
}

function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s
}
