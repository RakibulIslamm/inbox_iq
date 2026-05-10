import type { Metadata } from "next"
import Link from "next/link"
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  CreditCard,
  FileSignature,
  Inbox,
  ListChecks,
  MailX,
  Newspaper,
  PenLine,
  Reply,
  Sparkles,
  Truck,
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
import { Stat } from "@/components/stat"
import { cn } from "@/lib/utils"
import { ACTION_TYPES, type NoReplyReason } from "@/lib/ai/agents/classifier"
import { readAIEnv } from "@/lib/ai/env"
import { createClient } from "@/lib/supabase/server"
import { ActionizeButton } from "./actionize-button"
import { ActionDoneCheckbox } from "./action-done-checkbox"

export const metadata: Metadata = { title: "Actions" }

type SearchParams = Promise<{
  type?: string
}>

type Row = {
  id: number
  subject: string | null
  sender: string | null
  summary: string | null
  urgency_score: number | null
  category: string | null
  action_type: string | null
  no_reply_reason: string | null
  action_done_at: string | null
  replied_at: string | null
  received_at: string | null
}

type BucketKey = "reply" | "schedule" | "pay" | "sign" | "review" | "track" | "read"

const BUCKET_ORDER: BucketKey[] = [
  "reply",
  "schedule",
  "pay",
  "sign",
  "review",
  "track",
  "read",
]

const BUCKET_META: Record<
  BucketKey,
  {
    label: string
    description: string
    icon: typeof Reply
    tone: string
  }
> = {
  reply: {
    label: "Reply",
    description: "Someone is waiting on your words.",
    icon: Reply,
    tone: "border-foreground/30 text-foreground",
  },
  schedule: {
    label: "Schedule",
    description: "Calendar coordination — meetings, RSVPs, reschedules.",
    icon: CalendarClock,
    tone: "border-foreground/30 text-foreground",
  },
  pay: {
    label: "Pay",
    description: "Money out — invoices, renewals, reimbursements.",
    icon: CreditCard,
    tone: "border-destructive/40 text-destructive",
  },
  sign: {
    label: "Sign",
    description: "E-signature or formal acceptance.",
    icon: FileSignature,
    tone: "border-foreground/30 text-foreground",
  },
  review: {
    label: "Review",
    description: "Read carefully and decide; no reply yet.",
    icon: PenLine,
    tone: "border-foreground/30 text-foreground",
  },
  track: {
    label: "Track",
    description: "Passive watch — shipments, deliveries, orders.",
    icon: Truck,
    tone: "border-muted-foreground/30 text-muted-foreground",
  },
  read: {
    label: "Read",
    description: "FYI worth keeping. Read-and-file.",
    icon: Newspaper,
    tone: "border-muted-foreground/30 text-muted-foreground",
  },
}

const NO_REPLY_LABEL: Record<NoReplyReason, string> = {
  no_reply_sender: "No-reply sender",
  automated: "Automated alert",
  fyi: "FYI",
  newsletter: "Newsletter",
  marketing: "Marketing",
  receipt: "Receipt",
}

const FILTER_DEFS: { label: string; value: string | null }[] = [
  { label: "All", value: null },
  { label: "Reply", value: "reply" },
  { label: "Schedule", value: "schedule" },
  { label: "Pay", value: "pay" },
  { label: "Sign", value: "sign" },
  { label: "Review", value: "review" },
  { label: "Track", value: "track" },
  { label: "Read", value: "read" },
  { label: "No-reply", value: "no_reply" },
  { label: "Done", value: "done" },
]

export default async function ActionsPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const params = await searchParams
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

  const validFilters = new Set<string>([...ACTION_TYPES, "no_reply", "done"])
  const activeFilter = params.type && validFilters.has(params.type) ? params.type : null

  const { data: rows } = await supabase
    .from("emails")
    .select(
      "id, subject, sender, summary, urgency_score, category, action_type, no_reply_reason, action_done_at, replied_at, received_at"
    )
    .eq("user_id", user.id)
    .not("category", "is", null)
    .order("urgency_score", { ascending: false, nullsFirst: false })
    .order("received_at", { ascending: false, nullsFirst: false })
    .limit(500)

  const all = (rows ?? []) as Row[]
  const uncategorizedCount = all.filter((r) => r.action_type === null).length

  const dayStart = new Date()
  dayStart.setHours(0, 0, 0, 0)
  const dayStartIso = dayStart.toISOString()

  // Group all action_type-set rows into buckets. Skip "none" — it's a model
  // signal that the email is noise; surface those only via the "Read" bucket
  // or No-reply card.
  const buckets: Record<BucketKey, Row[]> = {
    reply: [],
    schedule: [],
    pay: [],
    sign: [],
    review: [],
    track: [],
    read: [],
  }
  const noReplyRows: Row[] = []
  const doneRows: Row[] = []
  let openActions = 0
  let doneToday = 0

  for (const row of all) {
    if (row.action_done_at) {
      doneRows.push(row)
      if (row.action_done_at >= dayStartIso) doneToday += 1
      continue
    }
    if (row.action_type && row.action_type !== "none" && row.action_type in buckets) {
      buckets[row.action_type as BucketKey].push(row)
      openActions += 1
    }
    if (row.no_reply_reason) {
      noReplyRows.push(row)
    }
  }

  const bucketsToShow: BucketKey[] = activeFilter && activeFilter in buckets
    ? [activeFilter as BucketKey]
    : BUCKET_ORDER

  const showNoReply = activeFilter === "no_reply"
  const showDone = activeFilter === "done"
  const showAll = activeFilter === null
  const noResults =
    !showDone &&
    !showNoReply &&
    bucketsToShow.every((b) => buckets[b].length === 0)

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ListChecks className="size-4" />
          <h1 className="text-sm font-medium">Actions</h1>
        </div>
        <Link
          href="/dashboard"
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Back to inbox →
        </Link>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Open actions" value={openActions} />
        <Stat label="No-reply mail" value={noReplyRows.length} />
        <Stat label="Done today" value={doneToday} />
      </div>

      {/* Backfill banner */}
      {uncategorizedCount > 0 ? (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Sparkles className="size-4" />
              <CardTitle>
                {uncategorizedCount} email{uncategorizedCount === 1 ? "" : "s"} missing action types
              </CardTitle>
            </div>
            <CardDescription>
              These were classified before action types existed. One click sorts
              them into the right buckets below.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <ActionizeButton
              disabled={!aiConfigured}
              disabledReason={
                aiReason === "disabled"
                  ? "AI is disabled for this deployment."
                  : aiReason === "missing"
                    ? "Set OPENROUTER_API_KEY in .env.local."
                    : undefined
              }
            />
            {!aiConfigured && aiReason === "disabled" ? (
              <div className="flex items-start gap-2 border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-700 dark:text-amber-400">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                <span>
                  <strong>AI is disabled for this deployment.</strong> Clone the
                  repo locally to try it.
                </span>
              </div>
            ) : !aiConfigured ? (
              <p className="text-xs text-muted-foreground">
                Set{" "}
                <code className="rounded bg-muted px-1">OPENROUTER_API_KEY</code>{" "}
                to enable AI categorization.
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {/* Filter chips */}
      <FilterChips
        active={activeFilter}
        counts={{
          reply: buckets.reply.length,
          schedule: buckets.schedule.length,
          pay: buckets.pay.length,
          sign: buckets.sign.length,
          review: buckets.review.length,
          track: buckets.track.length,
          read: buckets.read.length,
          no_reply: noReplyRows.length,
          done: doneRows.length,
        }}
        total={openActions}
      />

      {/* Empty state when nothing in the visible filter */}
      {all.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Nothing classified yet</CardTitle>
            <CardDescription>
              Sync and process emails from the inbox to see actions grouped here.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href="/dashboard"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <Inbox className="size-3.5" />
              Go to inbox
            </Link>
          </CardContent>
        </Card>
      ) : null}

      {/* Action buckets */}
      {showAll || (activeFilter && activeFilter in buckets)
        ? bucketsToShow.map((key) => {
            const items = buckets[key]
            if (items.length === 0) return null
            return <BucketCard key={key} bucket={key} items={items} />
          })
        : null}

      {/* Filtered "no actions in this bucket" */}
      {!showAll && !showNoReply && !showDone && noResults && all.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Nothing in this bucket</CardTitle>
            <CardDescription>
              Try a different filter, or clear filters to see everything.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {/* Done list (when filter=done) */}
      {showDone ? (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-4" />
              <CardTitle>Done ({doneRows.length})</CardTitle>
            </div>
            <CardDescription>
              Actions you&apos;ve marked complete. Uncheck to reopen.
            </CardDescription>
          </CardHeader>
          {doneRows.length > 0 ? (
            <CardContent className="px-0">
              <ul className="divide-y divide-border border-y border-border">
                {doneRows.map((row) => (
                  <ActionRow key={row.id} row={row} done />
                ))}
              </ul>
            </CardContent>
          ) : (
            <CardContent>
              <p className="text-xs text-muted-foreground">
                Nothing marked done yet.
              </p>
            </CardContent>
          )}
        </Card>
      ) : null}

      {/* No-reply mail card — always rendered when there's data, expanded when filtered */}
      {(showAll || showNoReply) && noReplyRows.length > 0 ? (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <MailX className="size-4" />
              <CardTitle>No-reply mail ({noReplyRows.length})</CardTitle>
            </div>
            <CardDescription>
              Newsletters, automated alerts, and FYI mail. InboxIQ skipped
              drafting replies for these.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            <ul className="divide-y divide-border border-y border-border">
              {(showNoReply ? noReplyRows : noReplyRows.slice(0, 5)).map((row) => (
                <NoReplyRow key={row.id} row={row} />
              ))}
            </ul>
            {!showNoReply && noReplyRows.length > 5 ? (
              <div className="px-4 py-3">
                <Link
                  href="/dashboard/actions?type=no_reply"
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  See all {noReplyRows.length} →
                </Link>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
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
        const href = value ? `/dashboard/actions?type=${value}` : "/dashboard/actions"
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

function BucketCard({ bucket, items }: { bucket: BucketKey; items: Row[] }) {
  const meta = BUCKET_META[bucket]
  const Icon = meta.icon
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className="size-4" />
            <CardTitle>
              {meta.label} ({items.length})
            </CardTitle>
          </div>
          <Badge variant="outline" className={cn("uppercase", meta.tone)}>
            {bucket}
          </Badge>
        </div>
        <CardDescription>{meta.description}</CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        <ul className="divide-y divide-border border-y border-border">
          {items.map((row) => (
            <ActionRow key={row.id} row={row} done={false} />
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

function ActionRow({ row, done }: { row: Row; done: boolean }) {
  return (
    <li className="px-4 py-3">
      <div className="flex items-start gap-3">
        <ActionDoneCheckbox
          emailId={row.id}
          initialDone={done}
          label={row.subject ?? "(no subject)"}
        />
        <Link
          href={`/dashboard/emails/${row.id}`}
          className="group min-w-0 flex-1"
        >
          <div className="flex items-center gap-2">
            <span className="truncate text-xs font-medium">
              {row.sender ?? "(unknown sender)"}
            </span>
            {row.urgency_score != null ? (
              <span className="ml-auto text-xs font-medium tabular-nums">
                {row.urgency_score}/10
              </span>
            ) : null}
          </div>
          <p
            className={cn(
              "truncate text-xs group-hover:underline",
              done && "line-through text-muted-foreground"
            )}
          >
            {row.subject ?? "(no subject)"}
          </p>
          {row.summary ? (
            <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
              {row.summary}
            </p>
          ) : null}
        </Link>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {row.replied_at ? (
            <Badge variant="outline" className="border-foreground/30">
              Replied
            </Badge>
          ) : null}
          <ArrowRight className="size-3.5 text-muted-foreground" />
        </div>
      </div>
    </li>
  )
}

function NoReplyRow({ row }: { row: Row }) {
  const reasonLabel = row.no_reply_reason
    ? NO_REPLY_LABEL[row.no_reply_reason as NoReplyReason]
    : "No reply"
  return (
    <li className="px-4 py-3">
      <Link href={`/dashboard/emails/${row.id}`} className="block group">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-xs font-medium text-muted-foreground">
                {row.sender ?? "(unknown sender)"}
              </span>
            </div>
            <p className="truncate text-xs">{row.subject ?? "(no subject)"}</p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <Badge
              variant="outline"
              className="border-muted-foreground/30 text-muted-foreground"
            >
              {reasonLabel}
            </Badge>
            <ArrowRight className="size-3.5 text-muted-foreground transition-colors group-hover:text-foreground" />
          </div>
        </div>
      </Link>
    </li>
  )
}

