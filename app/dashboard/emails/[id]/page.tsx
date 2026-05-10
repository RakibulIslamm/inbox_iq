import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, CheckCircle2, Sparkles } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { readAIEnv } from "@/lib/ai/env"
import { createClient } from "@/lib/supabase/server"
import { ReplyForm } from "./reply-form"

type RouteParams = Promise<{ id: string }>

const CATEGORY_TONE: Record<string, string> = {
  urgent: "border-destructive/40 text-destructive",
  client: "border-foreground/30 text-foreground",
  newsletter: "border-muted-foreground/30 text-muted-foreground",
  spam: "border-muted-foreground/30 text-muted-foreground",
  personal: "border-foreground/20 text-foreground",
}

export default async function EmailDetailPage({
  params,
}: {
  params: RouteParams
}) {
  const { id } = await params
  const numericId = Number.parseInt(id, 10)
  if (!Number.isFinite(numericId)) notFound()

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: email } = await supabase
    .from("emails")
    .select(
      "id, subject, sender, to_header, cc_header, snippet, body, category, urgency_score, summary, action_items, draft_reply, received_at, replied_at"
    )
    .eq("id", numericId)
    .eq("user_id", user.id)
    .maybeSingle()

  if (!email) notFound()

  const aiConfigured = readAIEnv().configured
  const date = email.received_at ? new Date(email.received_at) : null
  const dateLabel = date
    ? date.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : null
  const tone = email.category ? CATEGORY_TONE[email.category] : null
  const actionItems = (email.action_items as string[] | null) ?? []

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-8">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        Back to inbox
      </Link>

      {email.replied_at ? (
        <div className="flex items-center gap-2 border border-foreground/20 px-3 py-2 text-xs">
          <CheckCircle2 className="size-3.5" />
          <span>
            Replied {new Date(email.replied_at).toLocaleString(undefined, {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
            .
          </span>
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-1">
              <CardTitle>{email.subject ?? "(no subject)"}</CardTitle>
              <CardDescription>
                <span className="font-medium text-foreground">
                  {email.sender ?? "(unknown sender)"}
                </span>
                {dateLabel ? <> · {dateLabel}</> : null}
                {email.to_header ? <> · to {email.to_header}</> : null}
              </CardDescription>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              {email.urgency_score != null ? (
                <span className="text-xs font-medium tabular-nums">
                  {email.urgency_score}/10
                </span>
              ) : null}
              {email.category ? (
                <Badge variant="outline" className={cn("uppercase", tone ?? undefined)}>
                  {email.category}
                </Badge>
              ) : (
                <Badge variant="outline">Not yet processed</Badge>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {email.summary || actionItems.length > 0 ? (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Sparkles className="size-4" />
              <CardTitle>AI summary</CardTitle>
            </div>
            <CardDescription>
              {email.summary ?? "No summary generated."}
            </CardDescription>
          </CardHeader>
          {actionItems.length > 0 ? (
            <CardContent>
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Action items
              </h3>
              <ul className="space-y-1.5">
                {actionItems.map((item, i) => (
                  <li
                    key={`action-${i}`}
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
              <p className="mt-2 text-xs text-muted-foreground">
                Checkbox state is local — InboxIQ doesn&apos;t persist task
                completion yet.
              </p>
            </CardContent>
          ) : null}
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Reply</CardTitle>
          <CardDescription>
            Edit the draft, regenerate with a different tone, then send via
            your Gmail account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ReplyForm
            emailId={email.id}
            initialDraft={email.draft_reply ?? ""}
            alreadyReplied={Boolean(email.replied_at)}
            aiConfigured={aiConfigured}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Original message</CardTitle>
          <CardDescription>
            Plain-text rendering of the email body that InboxIQ stored.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Separator className="mb-3" />
          {email.body ? (
            <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words font-sans text-xs leading-relaxed text-muted-foreground">
              {email.body}
            </pre>
          ) : email.snippet ? (
            <p className="text-xs text-muted-foreground">{email.snippet}</p>
          ) : (
            <p className="text-xs text-muted-foreground">
              No body or snippet available.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
