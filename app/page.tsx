import Link from "next/link"
import {
  ArrowRight,
  Check,
  Inbox,
  MailCheck,
  Sparkles,
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

export default function LandingPage() {
  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />
      <Hero />
      <Features />
      <Pricing />
      <SiteFooter />
    </div>
  )
}

function SiteHeader() {
  return (
    <header className="flex items-center justify-between border-b border-border px-4 py-3">
      <Link href="/" className="flex items-center gap-2 text-sm font-medium">
        <Inbox className="size-4" />
        <span>InboxIQ</span>
      </Link>

      <nav className="flex items-center gap-2">
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
    <section className="border-b border-border px-4 py-20">
      <div className="mx-auto max-w-3xl text-center">
        <Badge variant="outline" className="mb-6">
          AI inbox assistant
        </Badge>
        <h1 className="font-heading text-4xl leading-tight tracking-tight md:text-5xl">
          Email triage on autopilot.
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-sm text-muted-foreground md:text-sm">
          InboxIQ reads your inbox, ranks what matters, and drafts your replies
          — so you can stop drowning in email and start shipping.
        </p>
        <div className="mt-8 flex items-center justify-center gap-2">
          <Link href="/login" className={buttonVariants({ size: "lg" })}>
            Start free
            <ArrowRight className="size-3.5" />
          </Link>
          <Link
            href="#features"
            className={buttonVariants({ variant: "outline", size: "lg" })}
          >
            See how it works
          </Link>
        </div>
      </div>
    </section>
  )
}

const FEATURES = [
  {
    icon: Inbox,
    title: "Auto-categorize",
    description:
      "Every incoming email is sorted into urgent, client, personal, newsletter, or spam — with an urgency score 1–10.",
  },
  {
    icon: Sparkles,
    title: "AI summaries",
    description:
      "One-line summaries plus extracted action items mean you never have to re-read a thread.",
  },
  {
    icon: MailCheck,
    title: "Draft replies",
    description:
      "InboxIQ pre-writes replies in your voice. Approve, tweak, send — done in seconds.",
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
          <p className="mx-auto mt-3 max-w-xl text-xs text-muted-foreground">
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
      "AI draft replies",
      "Custom rules & filters",
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
          <p className="mt-3 text-xs text-muted-foreground">
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

function SiteFooter() {
  return (
    <footer className="px-4 py-8">
      <div className="mx-auto flex max-w-5xl items-center justify-between text-xs text-muted-foreground">
        <span>© {new Date().getFullYear()} InboxIQ</span>
        <span>Built for makers who hate email.</span>
      </div>
    </footer>
  )
}
