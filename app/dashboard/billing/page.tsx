import type { Metadata } from "next"
import {
  AlertTriangle,
  CheckCircle2,
  Sparkles,
} from "lucide-react"

export const metadata: Metadata = { title: "Billing" }

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
import { FREE_PLAN, PRO_PLAN, readStripeEnv } from "@/lib/stripe/env"
import { createClient } from "@/lib/supabase/server"

type SearchParams = Promise<{
  stripe?: string
  stripe_error?: string
}>

const STATUS_MESSAGES: Record<string, { tone: "success" | "error"; text: string }> = {
  success: { tone: "success", text: "You're on Pro. Welcome aboard." },
  cancelled: {
    tone: "error",
    text: "Checkout was cancelled. You can try again any time.",
  },
  already_pro: { tone: "success", text: "You're already on the Pro plan." },
}

const ERROR_MESSAGES: Record<string, string> = {
  no_customer:
    "We don't have a Stripe customer on file yet. Click Upgrade to start a subscription.",
  no_session_url:
    "Stripe didn't return a checkout URL. Try again, or check the server logs.",
  profile_lookup_failed:
    "Couldn't read your profile. Try refreshing.",
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
    .select("plan, stripe_customer_id")
    .eq("id", user.id)
    .maybeSingle()

  const plan: "free" | "pro" = profile?.plan === "pro" ? "pro" : "free"
  const hasCustomer = Boolean(profile?.stripe_customer_id)

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

      {status ? <StatusBanner tone={status.tone} message={status.text} /> : null}
      {errorText ? <StatusBanner tone="error" message={errorText} /> : null}

      {!stripeCfg.configured ? (
        <Card>
          <CardHeader>
            <AlertTriangle className="size-4 text-destructive" />
            <CardTitle className="mt-2">Stripe is not configured</CardTitle>
            <CardDescription>
              Missing env: {stripeCfg.missing.map((m) => (
                <code key={m} className="mx-1 rounded bg-muted px-1">
                  {m}
                </code>
              ))}
              . See the README for the Phase 5 setup.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

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
            <form method="POST" action="/api/stripe/portal">
              <Button type="submit" variant="outline">
                Manage subscription
              </Button>
            </form>
            <p className="mt-2 text-xs text-muted-foreground">
              Opens the Stripe Customer Portal — update payment method,
              download invoices, or cancel.
            </p>
          </CardContent>
        ) : null}
      </Card>

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
    </div>
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
    <div className={cn("flex items-start gap-2 border px-3 py-2 text-xs", className)}>
      <Icon className="mt-0.5 size-3.5 shrink-0" />
      <span>{message}</span>
    </div>
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
