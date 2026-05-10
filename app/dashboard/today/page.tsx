import type { Metadata } from "next"
import Link from "next/link"
import { AlertTriangle, ArrowRight, CalendarDays, Mail, Sparkles } from "lucide-react"

export const metadata: Metadata = { title: "Today" }

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
import { readAIEnv } from "@/lib/ai/env"
import { createClient } from "@/lib/supabase/server"
import { GenerateSummaryButton } from "./generate-button"

const CATEGORY_TONE: Record<string, string> = {
  urgent: "border-destructive/40 text-destructive",
  client: "border-foreground/30 text-foreground",
  newsletter: "border-muted-foreground/30 text-muted-foreground",
  spam: "border-muted-foreground/30 text-muted-foreground",
  personal: "border-foreground/20 text-foreground",
}

export default async function TodayPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const aiEnv = readAIEnv()
  const aiConfigured = aiEnv.configured
  const aiReason: "disabled" | "missing" | null = aiConfigured
    ? null
    : aiEnv.reason
  const today = new Date().toISOString().slice(0, 10)
  const dayStart = new Date()
  dayStart.setUTCHours(0, 0, 0, 0)

  const [{ data: dailyRow }, { data: emails }] = await Promise.all([
    supabase
      .from("daily_summaries")
      .select("summary, action_items, created_at")
      .eq("user_id", user.id)
      .eq("date", today)
      .maybeSingle(),
    supabase
      .from("emails")
      .select(
        "id, subject, sender, category, urgency_score, summary, action_items, draft_reply, received_at, replied_at"
      )
      .eq("user_id", user.id)
      .not("category", "is", null)
      .gte("processed_at", dayStart.toISOString())
      .order("urgency_score", { ascending: false, nullsFirst: false })
      .order("received_at", { ascending: false, nullsFirst: false })
      .limit(50),
  ])

  const todaysEmails = emails ?? []
  const top3Urgent = [...todaysEmails]
    .filter((e) => (e.urgency_score ?? 0) >= 6)
    .slice(0, 3)
  const draftCount = todaysEmails.filter((e) => e.draft_reply).length
  const dailyActions = (dailyRow?.action_items as string[] | null) ?? []

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarDays className="size-4" />
          <h1 className="text-sm font-medium">
            Today · {new Date().toLocaleDateString(undefined, {
              weekday: "long",
              month: "short",
              day: "numeric",
            })}
          </h1>
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
        <Stat label="Classified today" value={todaysEmails.length} />
        <Stat
          label="Urgent (≥6)"
          value={todaysEmails.filter((e) => (e.urgency_score ?? 0) >= 6).length}
        />
        <Stat label="Drafts ready" value={draftCount} />
      </div>

      {/* Daily summary card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4" />
              <CardTitle>Briefing</CardTitle>
            </div>
            {dailyRow ? (
              <Badge variant="outline">
                Generated{" "}
                {new Date(dailyRow.created_at).toLocaleTimeString(undefined, {
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </Badge>
            ) : null}
          </div>
          <CardDescription>
            {dailyRow?.summary ??
              "No briefing yet. Run the summarizer or wait for the daily cron at 08:00 UTC."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <GenerateSummaryButton
            hasExisting={Boolean(dailyRow)}
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
              to enable AI summaries.
            </p>
          ) : null}
        </CardContent>
      </Card>

      {/* Top urgent emails */}
      <Card>
        <CardHeader>
          <CardTitle>Top urgent today</CardTitle>
          <CardDescription>
            {top3Urgent.length === 0
              ? todaysEmails.length === 0
                ? "Nothing classified today yet. Sync + Process from the inbox to see urgent items here."
                : "Nothing urgent today. Take a breath — everything classified is below 6/10."
              : `Top ${top3Urgent.length} email${top3Urgent.length === 1 ? "" : "s"} ranked by urgency_score.`}
          </CardDescription>
        </CardHeader>
        {top3Urgent.length > 0 ? (
          <CardContent className="px-0">
            <ul className="divide-y divide-border border-y border-border">
              {top3Urgent.map((email) => (
                <UrgentRow key={email.id} email={email} />
              ))}
            </ul>
          </CardContent>
        ) : todaysEmails.length === 0 ? (
          <CardContent>
            <Link
              href="/dashboard"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Go to inbox
            </Link>
          </CardContent>
        ) : null}
      </Card>

      {/* Aggregated action items */}
      <Card>
        <CardHeader>
          <CardTitle>Action items</CardTitle>
          <CardDescription>
            {dailyActions.length > 0
              ? "Deduplicated tasks pulled from the AI briefing."
              : "No deduplicated list yet — generate a briefing above."}
          </CardDescription>
        </CardHeader>
        {dailyActions.length > 0 ? (
          <CardContent>
            <ul className="space-y-1.5">
              {dailyActions.map((item, i) => (
                <li
                  key={`daily-${i}`}
                  className="flex items-start gap-2 text-xs"
                >
                  <input
                    type="checkbox"
                    className="mt-0.5 size-3.5 shrink-0 cursor-pointer"
                    aria-label={`Mark "${item}" as done`}
                  />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        ) : null}
      </Card>

      {/* Drafts ready */}
      {draftCount > 0 ? (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Drafts ready ({draftCount})</CardTitle>
              <Mail className="size-4 text-muted-foreground" />
            </div>
            <CardDescription>
              AI has drafted replies for these. Open one to edit and send.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            <ul className="divide-y divide-border border-y border-border">
              {todaysEmails
                .filter((e) => e.draft_reply)
                .map((email) => (
                  <DraftRow key={email.id} email={email} />
                ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}

type EmailRow = {
  id: number
  subject: string | null
  sender: string | null
  category: string | null
  urgency_score: number | null
  summary: string | null
  draft_reply: string | null
  received_at: string | null
  replied_at: string | null
}

function UrgentRow({ email }: { email: EmailRow }) {
  const tone = email.category ? CATEGORY_TONE[email.category] : null
  return (
    <li className="px-4 py-3">
      <Link href={`/dashboard/emails/${email.id}`} className="block group">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-xs font-medium">
                {email.sender ?? "(unknown sender)"}
              </span>
              {email.urgency_score != null ? (
                <span className="ml-auto text-xs font-medium tabular-nums">
                  {email.urgency_score}/10
                </span>
              ) : null}
            </div>
            <p className="truncate text-xs">
              {email.subject ?? "(no subject)"}
            </p>
            {email.summary ? (
              <p className="mt-1 text-xs text-muted-foreground">{email.summary}</p>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            {email.replied_at ? (
              <Badge variant="outline" className="border-foreground/30">
                Replied
              </Badge>
            ) : null}
            {email.category ? (
              <Badge variant="outline" className={cn("uppercase", tone ?? undefined)}>
                {email.category}
              </Badge>
            ) : null}
            <ArrowRight className="size-3.5 text-muted-foreground transition-colors group-hover:text-foreground" />
          </div>
        </div>
      </Link>
    </li>
  )
}

function DraftRow({ email }: { email: EmailRow }) {
  return (
    <li className="px-4 py-3">
      <Link href={`/dashboard/emails/${email.id}`} className="block group">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-xs font-medium">
                {email.sender ?? "(unknown sender)"}
              </span>
              {email.replied_at ? (
                <Badge variant="outline" className="ml-auto">
                  Sent
                </Badge>
              ) : null}
            </div>
            <p className="truncate text-xs">
              {email.subject ?? "(no subject)"}
            </p>
          </div>
          <ArrowRight className="size-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
        </div>
      </Link>
    </li>
  )
}
