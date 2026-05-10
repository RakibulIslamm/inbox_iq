import Link from "next/link"
import {
  ArrowRight,
  Check,
  Inbox,
  MailCheck,
  Sparkles,
  Zap,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ThemeToggle } from "@/components/theme-toggle"
import { readSupabaseEnv } from "@/lib/supabase/env"
import { createClient } from "@/lib/supabase/server"

export default async function LandingPage() {
  // When the visitor is already signed in, the Login / Get-started CTAs are
  // dead weight — swap them for a single "Dashboard" link so they get back
  // to the app in one click instead of through the login round-trip.
  let authenticated = false
  if (readSupabaseEnv().configured) {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    authenticated = Boolean(user)
  }

  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader authenticated={authenticated} />
      <Hero authenticated={authenticated} />
      <Features />
      {/* <SocialProof /> */}
      <HowItWorks />
      <Pricing authenticated={authenticated} />
      <FAQ />
      <FinalCTA authenticated={authenticated} />
      <SiteFooter authenticated={authenticated} />
    </div>
  )
}

function SiteHeader({ authenticated }: { authenticated: boolean }) {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/80 px-4 py-3 backdrop-blur">
      <Link href="/" className="flex items-center gap-2 text-sm font-medium">
        <Inbox className="size-4" />
        <span>InboxIQ</span>
      </Link>

      <nav className="flex items-center gap-1">
        <Link
          href="#features"
          className="hidden px-2 text-xs text-muted-foreground hover:text-foreground sm:inline"
        >
          Features
        </Link>
        <Link
          href="#pricing"
          className="hidden px-2 text-xs text-muted-foreground hover:text-foreground sm:inline"
        >
          Pricing
        </Link>
        <Link
          href="#faq"
          className="hidden px-2 text-xs text-muted-foreground hover:text-foreground sm:inline"
        >
          FAQ
        </Link>
        <ThemeToggle />
        {authenticated ? (
          <Link href="/dashboard" className={buttonVariants({ size: "sm" })}>
            Dashboard
          </Link>
        ) : (
          <>
            <Link
              href="/login"
              className={buttonVariants({ variant: "ghost", size: "sm" })}
            >
              Login
            </Link>
            <Link href="/login" className={buttonVariants({ size: "sm" })}>
              Get started
            </Link>
          </>
        )}
      </nav>
    </header>
  )
}

function Hero({ authenticated }: { authenticated: boolean }) {
  return (
    <section className="border-b border-border px-4 py-24">
      <div className="mx-auto max-w-3xl text-center">
        <Badge variant="outline" className="mb-6">
          <Sparkles className="size-3" />
          AI inbox assistant
        </Badge>
        <h1 className="font-heading text-4xl leading-[1.1] tracking-tight md:text-6xl">
          Email triage on autopilot.
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-sm leading-relaxed text-muted-foreground md:text-base">
          InboxIQ reads your inbox, ranks what matters by urgency, drafts your
          replies in your voice, and sends you a daily briefing — so you can
          stop drowning in email and start shipping.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-2">
          {authenticated ? (
            <Link href="/dashboard" className={buttonVariants({ size: "lg" })}>
              Open dashboard
              <ArrowRight className="size-3.5" />
            </Link>
          ) : (
            <Link href="/login" className={buttonVariants({ size: "lg" })}>
              Start free — 10 emails/day
              <ArrowRight className="size-3.5" />
            </Link>
          )}
          <Link
            href="#how-it-works"
            className={buttonVariants({ variant: "outline", size: "lg" })}
          >
            See how it works
          </Link>
        </div>
        {!authenticated ? (
          <p className="mt-4 text-xs text-muted-foreground">
            No credit card required · Cancel anytime · GDPR-friendly
          </p>
        ) : null}
      </div>
    </section>
  )
}

const FEATURES = [
  {
    icon: Inbox,
    title: "Auto-categorize",
    description:
      "Every incoming email is sorted into urgent, client, personal, newsletter, or spam — with a 1–10 urgency score so you know what to tackle first.",
  },
  {
    icon: Sparkles,
    title: "AI summaries",
    description:
      "One- or two-sentence summaries plus extracted action items mean you never have to re-read a long thread again.",
  },
  {
    icon: MailCheck,
    title: "Draft replies",
    description:
      "InboxIQ pre-writes context-aware replies in your voice. Approve, tweak the tone, send — done in seconds.",
  },
]

function Features() {
  return (
    <section id="features" className="border-b border-border px-4 py-20">
      <div className="mx-auto max-w-5xl">
        <div className="mb-10 text-center">
          <h2 className="font-heading text-2xl tracking-tight md:text-3xl">
            Built to make inbox zero feel boring.
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-xs text-muted-foreground md:text-sm">
            Three core capabilities, designed to disappear into your workflow.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, description }) => (
            <Card key={title}>
              <CardHeader>
                <Icon className="size-5" />
                <CardTitle className="mt-2">{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}

const TESTIMONIALS = [
  {
    quote:
      "I went from 200 unreads a day to actual inbox zero. The urgency scoring nails it 9 times out of 10.",
    name: "Maya R.",
    role: "Founder, indie SaaS",
  },
  {
    quote:
      "The draft replies sound like me. I just hit send. My response time dropped from days to minutes.",
    name: "Daniel K.",
    role: "Eng manager",
  },
  {
    quote:
      "Daily briefing is my new morning ritual. I open Slack already knowing what fires need to be put out.",
    name: "Priya S.",
    role: "Product lead",
  },
]

function SocialProof() {
  return (
    <section className="border-b border-border px-4 py-20">
      <div className="mx-auto max-w-5xl">
        <div className="mb-10 text-center">
          <h2 className="font-heading text-2xl tracking-tight md:text-3xl">
            Loved by people who hate email.
          </h2>
          <p className="mt-3 text-xs text-muted-foreground md:text-sm">
            Early users say it best.
          </p>
          <p className="mt-2 text-xs italic text-muted-foreground">
            Mock testimonials shown — InboxIQ is currently in beta.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <Card key={t.name}>
              <CardContent className="pt-4">
                <p className="text-xs leading-relaxed">&ldquo;{t.quote}&rdquo;</p>
                <div className="mt-4 flex items-center gap-2">
                  <div className="flex size-7 items-center justify-center rounded-full bg-muted text-xs font-medium">
                    {t.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-xs font-medium">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.role}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}

const STEPS = [
  {
    n: "01",
    title: "Connect Gmail",
    body: "One-click OAuth. We only request read + send scopes. Tokens stay encrypted in Supabase, gated by row-level security.",
  },
  {
    n: "02",
    title: "Sync & classify",
    body: "Pull your most recent 50 messages on demand. Each one gets a category, urgency score, summary, and (when needed) a draft reply.",
  },
  {
    n: "03",
    title: "Reply & ship",
    body: "Open any email, tweak the draft, hit send — straight from InboxIQ via the Gmail API. Or skim the daily briefing and triage in 2 minutes.",
  },
]

function HowItWorks() {
  return (
    <section id="how-it-works" className="border-b border-border px-4 py-20">
      <div className="mx-auto max-w-4xl">
        <div className="mb-10 text-center">
          <h2 className="font-heading text-2xl tracking-tight md:text-3xl">
            How it works.
          </h2>
          <p className="mt-3 text-xs text-muted-foreground md:text-sm">
            From signup to sent reply in under 3 minutes.
          </p>
        </div>
        <ol className="space-y-3">
          {STEPS.map((s) => (
            <li
              key={s.n}
              className="flex items-start gap-4 border border-border px-4 py-4"
            >
              <span className="font-heading text-xl tabular-nums text-muted-foreground">
                {s.n}
              </span>
              <div>
                <h3 className="text-sm font-medium">{s.title}</h3>
                <p className="mt-1 text-xs text-muted-foreground md:text-sm">
                  {s.body}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

const PLANS = [
  {
    name: "Free",
    price: "$0",
    cadence: "/mo",
    description: "Get a feel for AI-powered triage.",
    features: [
      "10 AI-classified emails per day",
      "Daily inbox summary",
      "Basic categorization",
      "Email + Google sign-in",
    ],
    cta: "Start free",
    highlight: false,
  },
  {
    name: "Pro",
    price: "$19",
    cadence: "/mo",
    description: "For people who actually live in their inbox.",
    features: [
      "Unlimited AI-classified emails",
      "AI draft replies with tone control",
      "Unlimited daily summaries",
      "Priority support",
    ],
    cta: "Upgrade to Pro",
    highlight: true,
  },
]

function Pricing({ authenticated }: { authenticated: boolean }) {
  return (
    <section id="pricing" className="border-b border-border px-4 py-20">
      <div className="mx-auto max-w-4xl">
        <div className="mb-10 text-center">
          <h2 className="font-heading text-2xl tracking-tight md:text-3xl">
            Simple pricing.
          </h2>
          <p className="mt-3 text-xs text-muted-foreground md:text-sm">
            Start free. Upgrade when you&apos;re ready.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {PLANS.map((plan) => {
            // When the visitor is signed in, both plan CTAs send them to the
            // billing page so they can compare and (for Pro) check out from
            // there. When not signed in, both go through the login flow.
            const ctaHref = authenticated
              ? plan.highlight
                ? "/dashboard/billing"
                : "/dashboard"
              : "/login"
            const ctaLabel = authenticated
              ? plan.highlight
                ? "Manage billing"
                : "Open dashboard"
              : plan.cta
            return (
              <Card
                key={plan.name}
                className={plan.highlight ? "ring-2 ring-foreground" : undefined}
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>{plan.name}</CardTitle>
                    {plan.highlight ? <Badge>Most popular</Badge> : null}
                  </div>
                  <CardDescription>{plan.description}</CardDescription>
                  <div className="mt-3 flex items-baseline gap-1">
                    <span className="font-heading text-3xl">{plan.price}</span>
                    <span className="text-xs text-muted-foreground">
                      {plan.cadence}
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-xs">
                        <Check className="mt-0.5 size-3.5 shrink-0" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-5">
                    <Link
                      href={ctaHref}
                      className={buttonVariants({
                        variant: plan.highlight ? "default" : "outline",
                        className: "w-full",
                      })}
                    >
                      {ctaLabel}
                    </Link>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    </section>
  )
}

const FAQS = [
  {
    q: "Does InboxIQ store my emails?",
    a: "We cache the most recent 50 messages you sync, plus the AI's classification. Bodies are capped at 50,000 characters per message and protected by Supabase row-level security — only your account can read them. Disconnect Gmail at any time to revoke access; cancel your account to delete everything.",
  },
  {
    q: "What scopes does the Gmail integration use?",
    a: "Two: gmail.readonly (to fetch and triage) and gmail.send (to send the replies you approve). We never modify or delete your existing messages.",
  },
  {
    q: "Which AI model does InboxIQ use?",
    a: "We route all calls through OpenRouter, defaulting to a fast, cost-efficient frontier model. The pipeline is provider-agnostic — switching to Claude, GPT, or Gemini is a one-line config change.",
  },
  {
    q: "What's the free tier limit?",
    a: "10 AI-classified emails per calendar day. Sync, viewing already-classified emails, and sending replies stay free. Upgrade to Pro for unlimited classifications and daily summaries.",
  },
  {
    q: "Can I cancel my Pro subscription?",
    a: "Yes — anytime, from the Stripe Customer Portal we link to inside the dashboard. You keep Pro access until the end of the period you've already paid for, then drop back to Free automatically.",
  },
  {
    q: "Is there a self-hosted option?",
    a: "InboxIQ is open enough that you can run your own copy: Next.js + Supabase + your OpenRouter key. The full source lives in the GitHub repo linked below.",
  },
]

function FAQ() {
  return (
    <section id="faq" className="border-b border-border px-4 py-20">
      <div className="mx-auto max-w-3xl">
        <div className="mb-10 text-center">
          <h2 className="font-heading text-2xl tracking-tight md:text-3xl">
            Questions, answered.
          </h2>
          <p className="mt-3 text-xs text-muted-foreground md:text-sm">
            The things people usually ask before signing up.
          </p>
        </div>
        <div className="space-y-2">
          {FAQS.map((item) => (
            <details
              key={item.q}
              className="group border border-border px-4 py-3 [&_summary::-webkit-details-marker]:hidden"
            >
              <summary className="flex cursor-pointer items-center justify-between text-sm font-medium">
                <span>{item.q}</span>
                <span className="text-muted-foreground transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground md:text-sm">
                {item.a}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}

function FinalCTA({ authenticated }: { authenticated: boolean }) {
  return (
    <section className="border-b border-border px-4 py-20">
      <div className="mx-auto max-w-2xl text-center">
        <Zap className="mx-auto size-5" />
        <h2 className="mt-4 font-heading text-2xl tracking-tight md:text-3xl">
          Stop reading email. Start replying.
        </h2>
        <p className="mt-3 text-xs text-muted-foreground md:text-sm">
          {authenticated
            ? "Your inbox is one click away."
            : "Two minutes to connect Gmail. Free for the first 10 classifications a day."}
        </p>
        <div className="mt-6">
          {authenticated ? (
            <Link href="/dashboard" className={buttonVariants({ size: "lg" })}>
              Open dashboard
              <ArrowRight className="size-3.5" />
            </Link>
          ) : (
            <Link href="/login" className={buttonVariants({ size: "lg" })}>
              Get started
              <ArrowRight className="size-3.5" />
            </Link>
          )}
        </div>
      </div>
    </section>
  )
}

function SiteFooter({ authenticated }: { authenticated: boolean }) {
  return (
    <footer className="px-4 py-8">
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-3 text-xs text-muted-foreground sm:flex-row">
        <div className="flex flex-col items-center gap-1 sm:items-start">
          <span>© {new Date().getFullYear()} InboxIQ</span>
          <span>
            Built by{" "}
            <a
              href="https://www.linkedin.com/in/d-rakibul-islam/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-medium text-foreground hover:underline"
            >
              <LinkedinIcon className="size-3" />
              Rakibul Islam
            </a>
          </span>
        </div>
        <div className="flex items-center gap-4">
          <a
            href="https://github.com/RakibulIslamm/inbox_iq"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 hover:text-foreground"
          >
            <GithubIcon className="size-3.5" />
            GitHub
          </a>
          <Link href="#features" className="hover:text-foreground">
            Features
          </Link>
          <Link href="#pricing" className="hover:text-foreground">
            Pricing
          </Link>
          <Link href="#faq" className="hover:text-foreground">
            FAQ
          </Link>
          {authenticated ? (
            <Link href="/dashboard" className="hover:text-foreground">
              Dashboard
            </Link>
          ) : (
            <Link href="/login" className="hover:text-foreground">
              Login
            </Link>
          )}
        </div>
      </div>
    </footer>
  )
}

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg
      role="img"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      fill="currentColor"
      className={className}
      aria-label="GitHub"
    >
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.305-5.467-1.332-5.467-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.4 3-.405 1.02.005 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  )
}

function LinkedinIcon({ className }: { className?: string }) {
  return (
    <svg
      role="img"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      fill="currentColor"
      className={className}
      aria-label="LinkedIn"
    >
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.063 2.063 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  )
}
