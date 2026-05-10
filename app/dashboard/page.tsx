import Link from "next/link"
import {
  AlertTriangle,
  CheckCircle2,
  Mail,
  RefreshCw,
  Unplug,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Stat } from "@/components/stat"
import { cn } from "@/lib/utils"
import { disconnectGmail } from "@/app/actions/gmail"
import { readAIEnv } from "@/lib/ai/env"
import { readGmailEnv } from "@/lib/gmail/env"
import { createClient } from "@/lib/supabase/server"
import { EMAIL_CATEGORIES } from "@/lib/ai/agents/classifier"
import { LastSync } from "./last-sync"
import { ProcessButton } from "./process-button"
import { SyncButton } from "./sync-button"

type SearchParams = Promise<{
  gmail?: string
  gmail_error?: string
  cat?: string
}>

const ERROR_MESSAGES: Record<string, string> = {
  gmail_not_configured:
    "Gmail OAuth credentials are missing. Add them to .env.local and restart dev.",
  state_mismatch:
    "OAuth state didn't match. Try connecting again from this tab.",
  missing_params: "Google didn't return an authorization code. Try again.",
  exchange_failed: "Couldn't exchange the OAuth code with Google. Try again.",
  no_refresh_token:
    "Google didn't return a refresh token. Revoke the app at myaccount.google.com/permissions and reconnect.",
  persist_failed:
    "Authorized with Google but couldn't save the connection. Try again.",
  access_denied: "You declined the consent screen. Connect when ready.",
}

const FILTER_DEFS: { label: string; value: string | null }[] = [
  { label: "All", value: null },
  { label: "Urgent", value: "urgent" },
  { label: "Client", value: "client" },
  { label: "Newsletter", value: "newsletter" },
  { label: "Spam", value: "spam" },
  { label: "Personal", value: "personal" },
]

const CATEGORY_TONE: Record<string, string> = {
  urgent: "border-destructive/40 text-destructive",
  client: "border-foreground/30 text-foreground",
  newsletter: "border-muted-foreground/30 text-muted-foreground",
  spam: "border-muted-foreground/30 text-muted-foreground",
  personal: "border-foreground/20 text-foreground",
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const params = await searchParams
  const gmailConfigured = readGmailEnv().configured
  const aiEnv = readAIEnv()
  const aiConfigured = aiEnv.configured
  const aiReason: "disabled" | "missing" | null = aiConfigured
    ? null
    : aiEnv.reason

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: connection } = await supabase
    .from("gmail_connections")
    .select("user_id, created_at, gmail_email")
    .eq("user_id", user.id)
    .maybeSingle()

  const connected = Boolean(connection)
  const connectedEmail =
    (connection?.gmail_email as string | null | undefined) ?? null

  const activeCategory =
    params.cat && (EMAIL_CATEGORIES as readonly string[]).includes(params.cat)
      ? (params.cat as (typeof EMAIL_CATEGORIES)[number])
      : null

  // Default empty values; populated below when connected.
  let emails: EmailRow[] = []
  const counts: Record<string, number> = {}
  let totalClassified = 0
  let unprocessedCount = 0
  let urgentCount = 0
  let repliedTodayCount = 0
  let lastSyncIso: string | null = null

  if (connected) {
    const dayStart = new Date()
    dayStart.setHours(0, 0, 0, 0)

    // Fold all stats fetches into ≤ 3 queries:
    //  1. The visible email list (already needed)
    //  2. Per-category counts + classified-vs-unclassified buckets
    //  3. Most-recent processed_at (for LastSync)
    let listQuery = supabase
      .from("emails")
      .select(
        "id, subject, sender, snippet, category, urgency_score, summary, action_items, draft_reply, received_at, processed_at, replied_at"
      )
      .eq("user_id", user.id)
      .order("urgency_score", { ascending: false, nullsFirst: false })
      .order("received_at", { ascending: false, nullsFirst: false })
      .limit(50)
    if (activeCategory) listQuery = listQuery.eq("category", activeCategory)

    const [listRes, statsRes, syncRes] = await Promise.all([
      listQuery,
      supabase
        .from("emails")
        .select("category, urgency_score, replied_at")
        .eq("user_id", user.id),
      supabase
        .from("emails")
        .select("processed_at")
        .eq("user_id", user.id)
        .order("processed_at", { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle(),
    ])

    emails = (listRes.data ?? []) as EmailRow[]

    type StatsRow = {
      category: string | null
      urgency_score: number | null
      replied_at: string | null
    }
    const allRows = (statsRes.data ?? []) as StatsRow[]
    for (const r of allRows) {
      if (r.category) {
        counts[r.category] = (counts[r.category] ?? 0) + 1
        totalClassified += 1
        if ((r.urgency_score ?? 0) >= 6) urgentCount += 1
      } else {
        unprocessedCount += 1
      }
      if (r.replied_at && new Date(r.replied_at) >= dayStart) {
        repliedTodayCount += 1
      }
    }

    lastSyncIso = (syncRes.data?.processed_at as string | undefined) ?? null
  }

  const successMessage =
    params.gmail === "connected" ? "Gmail connected." : null
  const errorMessage = params.gmail_error
    ? ERROR_MESSAGES[params.gmail_error] ?? params.gmail_error
    : null

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-8">
      {successMessage ? (
        <StatusBanner tone="success" message={successMessage} />
      ) : null}
      {errorMessage ? (
        <StatusBanner tone="error" message={errorMessage} />
      ) : null}

      {!gmailConfigured ? (
        <GmailSetupCard />
      ) : connected ? (
        <ConnectedCard
          aiConfigured={aiConfigured}
          aiReason={aiReason}
          lastSyncIso={lastSyncIso}
          connectedEmail={connectedEmail}
        />
      ) : (
        <ConnectCard />
      )}

      {connected ? (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Total classified" value={totalClassified} />
            <Stat label="Unprocessed" value={unprocessedCount} />
            <Stat label="Urgent (≥6)" value={urgentCount} />
            <Stat label="Replied today" value={repliedTodayCount} />
          </div>

          <FilterChips
            active={activeCategory}
            counts={counts}
            total={totalClassified}
          />

          <EmailList
            emails={emails}
            activeCategory={activeCategory}
            totalClassified={totalClassified}
            unprocessedCount={unprocessedCount}
          />
        </>
      ) : null}
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

function GmailSetupCard() {
  return (
    <Card>
      <CardHeader>
        <AlertTriangle className="size-4 text-destructive" />
        <CardTitle className="mt-2">Gmail OAuth not configured</CardTitle>
        <CardDescription>
          Set <code className="rounded bg-muted px-1">GOOGLE_CLIENT_ID</code>,{" "}
          <code className="rounded bg-muted px-1">GOOGLE_CLIENT_SECRET</code>,
          and <code className="rounded bg-muted px-1">GOOGLE_REDIRECT_URI</code>{" "}
          in <code className="rounded bg-muted px-1">.env.local</code> and
          restart dev.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground">
          See the README for the full setup steps (Google Cloud OAuth client,
          consent screen scopes, redirect URI).
        </p>
      </CardContent>
    </Card>
  )
}

function ConnectCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Connect your Gmail</CardTitle>
        <CardDescription>
          InboxIQ needs read access to triage your inbox. We&apos;ll fetch your
          most recent 50 emails on demand.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-1.5 text-xs text-muted-foreground">
          <li>• Read-only scope (gmail.readonly)</li>
          <li>• Tokens stay encrypted in Supabase, gated by RLS</li>
          <li>• Disconnect anytime to revoke access</li>
        </ul>
      </CardContent>
      <CardFooter>
        <a
          href="/api/auth/gmail/init"
          className={buttonVariants({ className: "w-full" })}
        >
          <Mail className="size-3.5" />
          Connect Gmail
        </a>
      </CardFooter>
    </Card>
  )
}

function ConnectedCard({
  aiConfigured,
  aiReason,
  lastSyncIso,
  connectedEmail,
}: {
  aiConfigured: boolean
  aiReason: "disabled" | "missing" | null
  lastSyncIso: string | null
  connectedEmail: string | null
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <CardTitle className="flex flex-wrap items-center gap-2">
              Gmail connected
              {connectedEmail ? (
                <span
                  className="truncate text-xs font-normal text-muted-foreground"
                  title={connectedEmail}
                >
                  · {connectedEmail}
                </span>
              ) : null}
            </CardTitle>
          </div>
          <Badge variant="outline">
            <CheckCircle2 className="size-3" />
            Active
          </Badge>
        </div>
        <CardDescription>
          Sync to pull recent emails, then process them through the AI
          classifier to get categories, urgency scores, summaries, and draft
          replies.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <SyncButton />
          <ProcessButton
            disabled={!aiConfigured}
            disabledReason={
              aiReason === "disabled"
                ? "AI is disabled for this deployment."
                : aiReason === "missing"
                  ? "Set OPENROUTER_API_KEY in .env.local."
                  : undefined
            }
          />
        </div>

        {!aiConfigured && aiReason === "disabled" ? (
          <div className="flex items-start gap-2 border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-700 dark:text-amber-400">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            <span>
              <strong>AI is disabled for this deployment.</strong> Clone the
              repo locally to try it.
            </span>
          </div>
        ) : !aiConfigured ? (
          <div className="rounded-none border border-dashed border-border p-3 text-xs text-muted-foreground">
            Set{" "}
            <code className="rounded bg-muted px-1">OPENROUTER_API_KEY</code>{" "}
            in <code className="rounded bg-muted px-1">.env.local</code> to
            enable AI processing.
          </div>
        ) : null}

        <LastSync since={lastSyncIso} />

        <Separator />

        <form action={disconnectGmail}>
          <Button type="submit" variant="ghost" size="sm">
            <Unplug className="size-3.5" />
            Disconnect Gmail
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

function FilterChips({
  active,
  counts,
  total,
}: {
  active: string | null
  counts: Record<string, number>
  total: number
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {FILTER_DEFS.map(({ label, value }) => {
        const isActive = (value ?? null) === active
        const href = value ? `/dashboard?cat=${value}` : "/dashboard"
        const count = value === null ? total : counts[value] ?? 0
        return (
          <Link
            key={label}
            href={href}
            className={buttonVariants({
              variant: isActive ? "default" : "outline",
              size: "xs",
            })}
            aria-current={isActive ? "page" : undefined}
          >
            {label}
            {count > 0 ? (
              <span
                className={cn(
                  "ml-1 tabular-nums",
                  isActive ? "" : "text-muted-foreground"
                )}
              >
                ({count})
              </span>
            ) : null}
          </Link>
        )
      })}
    </div>
  )
}

type EmailRow = {
  id: number
  subject: string | null
  sender: string | null
  snippet: string | null
  category: string | null
  urgency_score: number | null
  summary: string | null
  action_items: string[] | null
  draft_reply: string | null
  received_at: string | null
  processed_at: string
  replied_at: string | null
}

function EmailList({
  emails,
  activeCategory,
  totalClassified,
  unprocessedCount,
}: {
  emails: EmailRow[]
  activeCategory: string | null
  totalClassified: number
  unprocessedCount: number
}) {
  if (emails.length === 0) {
    return <EmptyInbox activeCategory={activeCategory} />
  }

  // "Inbox zero" cue — only when no filter is active, all rows are
  // classified, and nothing is left unprocessed.
  const inboxZero =
    !activeCategory && totalClassified > 0 && unprocessedCount === 0

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Inbox · {emails.length}
          {activeCategory ? ` · ${activeCategory}` : ""}
        </CardTitle>
        <CardDescription>
          {inboxZero
            ? "Inbox zero (the AI version). Sync again to pull new arrivals."
            : "Sorted by urgency, then most recent. Unprocessed emails sit at the bottom."}
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        <ul className="divide-y divide-border border-y border-border">
          {emails.map((email) => (
            <EmailItem key={email.id} email={email} />
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

function EmptyInbox({ activeCategory }: { activeCategory: string | null }) {
  if (activeCategory) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No {activeCategory} emails</CardTitle>
          <CardDescription>
            Nothing in this bucket yet. Try another filter, or process more
            emails to fill it out.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link
            href="/dashboard"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            View all
          </Link>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Empty inbox</CardTitle>
        <CardDescription className="flex items-center gap-1.5">
          <RefreshCw className="size-3" />
          Sync to pull the most recent 50 messages from Gmail.
        </CardDescription>
      </CardHeader>
    </Card>
  )
}

function EmailItem({ email }: { email: EmailRow }) {
  const date = email.received_at
    ? new Date(email.received_at)
    : new Date(email.processed_at)
  const dateLabel = date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  })

  const tone = email.category ? CATEGORY_TONE[email.category] : null
  const showSummary = email.summary && email.summary.length > 0
  const showActions = (email.action_items?.length ?? 0) > 0

  return (
    <li className="px-4 py-3">
      {/* Whole row links to the detail page, except the draft-reply
          <details> block at the bottom (nested interactive elements). */}
      <Link
        href={`/dashboard/emails/${email.id}`}
        className="block group space-y-2"
      >
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-xs font-medium">
                {email.sender ?? "(unknown sender)"}
              </span>
              <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                {dateLabel}
              </span>
            </div>
            <p className="truncate text-xs group-hover:underline">
              {email.subject ?? "(no subject)"}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            {email.urgency_score != null ? (
              <span className="text-xs font-medium tabular-nums">
                {email.urgency_score}/10
              </span>
            ) : null}
            {email.replied_at ? (
              <Badge variant="outline" className="border-foreground/30">
                Replied
              </Badge>
            ) : null}
            {email.category ? (
              <Badge
                variant="outline"
                className={cn("uppercase", tone ?? undefined)}
              >
                {email.category}
              </Badge>
            ) : (
              <Badge variant="outline">Not yet processed</Badge>
            )}
          </div>
        </div>

        {showSummary ? (
          <p className="text-xs text-muted-foreground">{email.summary}</p>
        ) : email.snippet ? (
          <p className="line-clamp-2 text-xs text-muted-foreground">
            {email.snippet}
          </p>
        ) : null}

        {showActions ? (
          <ul className="space-y-0.5">
            {email.action_items!.map((item, i) => (
              <li
                key={`${email.id}-action-${i}`}
                className="flex gap-1.5 text-xs text-muted-foreground"
              >
                <span className="shrink-0">→</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </Link>

      {email.draft_reply ? (
        <details className="mt-2 text-xs">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
            View draft reply
          </summary>
          <pre className="mt-2 whitespace-pre-wrap rounded-none border border-border bg-muted/40 p-2 font-sans text-xs">
            {email.draft_reply}
          </pre>
        </details>
      ) : null}
    </li>
  )
}
