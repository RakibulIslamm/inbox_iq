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

export default function LandingPage() {
  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />
      <Hero />
      <Features />
      <SocialProof />
      <HowItWorks />
      <Pricing />
      <FAQ />
      <FinalCTA />
      <SiteFooter />
    </div>
  )
}

function SiteHeader() {
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
        <Link
          href="/login"
          className={buttonVariants({ variant: "ghost", size: "sm" })}
        >
          Login
        </Link>
        <Link href="/login" className={buttonVariants({ size: "sm" })}>
          Get started
        </Link>
      </nav>
    </header>
  )
}

function Hero() {
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
        <div className="mt-8 flex items-center justify-center gap-2">
          <Link href="/login" className={buttonVariants({ size: "lg" })}>
            Start free — 10 emails/day
            <ArrowRight className="size-3.5" />
          </Link>
          <Link
            href="#how-it-works"
            className={buttonVariants({ variant: "outline", size: "lg" })}
          >
            See how it works
          </Link>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          No credit card required · Cancel anytime · GDPR-friendly
        </p>
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

function Pricing() {
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
          {PLANS.map((plan) => (
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
                    href="/login"
                    className={buttonVariants({
                      variant: plan.highlight ? "default" : "outline",
                      className: "w-full",
                    })}
                  >
                    {plan.cta}
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
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

function FinalCTA() {
  return (
    <section className="border-b border-border px-4 py-20">
      <div className="mx-auto max-w-2xl text-center">
        <Zap className="mx-auto size-5" />
        <h2 className="mt-4 font-heading text-2xl tracking-tight md:text-3xl">
          Stop reading email. Start replying.
        </h2>
        <p className="mt-3 text-xs text-muted-foreground md:text-sm">
          Two minutes to connect Gmail. Free for the first 10 classifications a day.
        </p>
        <div className="mt-6">
          <Link href="/login" className={buttonVariants({ size: "lg" })}>
            Get started
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </div>
    </section>
  )
}

function SiteFooter() {
  return (
    <footer className="px-4 py-8">
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-2 text-xs text-muted-foreground sm:flex-row">
        <span>© {new Date().getFullYear()} InboxIQ</span>
        <div className="flex items-center gap-4">
          <Link href="#features" className="hover:text-foreground">
            Features
          </Link>
          <Link href="#pricing" className="hover:text-foreground">
            Pricing
          </Link>
          <Link href="#faq" className="hover:text-foreground">
            FAQ
          </Link>
          <Link href="/login" className="hover:text-foreground">
            Login
          </Link>
        </div>
      </div>
    </footer>
  )
}
