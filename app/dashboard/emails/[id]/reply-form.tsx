"use client"

import { useState, useTransition } from "react"
import { AlertTriangle, RefreshCw, Send } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  regenerateDraft,
  sendReply,
} from "@/app/actions/email"
import type { NoReplyReason } from "@/lib/ai/agents/classifier"

const TONES: { label: string; value: "shorter" | "longer" | "more-formal" | "more-casual" }[] = [
  { label: "Shorter", value: "shorter" },
  { label: "Longer", value: "longer" },
  { label: "More formal", value: "more-formal" },
  { label: "More casual", value: "more-casual" },
]

type Status =
  | { kind: "idle" }
  | { kind: "sent"; messageId: string }
  | { kind: "regenerated" }
  | { kind: "error"; error: string; reauth?: boolean }

export function ReplyForm({
  emailId,
  initialDraft,
  alreadyReplied,
  aiConfigured,
  aiReason,
  replyRequired = true,
}: {
  emailId: number
  initialDraft: string
  alreadyReplied: boolean
  aiConfigured: boolean
  aiReason: "disabled" | "missing" | null
  replyRequired?: boolean
  noReplyReason?: NoReplyReason | null
}) {
  const [body, setBody] = useState(initialDraft)
  const [status, setStatus] = useState<Status>({ kind: "idle" })
  const [pending, startTransition] = useTransition()

  function handleSend() {
    setStatus({ kind: "idle" })
    startTransition(async () => {
      const res = await sendReply({ emailId, body })
      if (res.ok) {
        setStatus({ kind: "sent", messageId: res.messageId })
        toast.success("Reply sent.", {
          description: `Gmail message id: ${res.messageId}`,
        })
      } else {
        setStatus({ kind: "error", error: res.error, reauth: res.reauth })
        toast.error("Couldn't send reply.", {
          description: res.reauth
            ? `${res.error} — reconnect Gmail in the dashboard.`
            : res.error,
        })
      }
    })
  }

  function handleRegenerate(tone: (typeof TONES)[number]["value"] | null) {
    setStatus({ kind: "idle" })
    startTransition(async () => {
      const res = await regenerateDraft({ emailId, tone })
      if (res.ok) {
        setBody(res.draft)
        setStatus({ kind: "regenerated" })
        toast.success("Draft regenerated.")
      } else {
        setStatus({ kind: "error", error: res.error })
        toast.error("Couldn't regenerate.", { description: res.error })
      }
    })
  }

  return (
    <div className="space-y-3">
      <textarea
        name="body"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={10}
        spellCheck={true}
        disabled={pending}
        className="w-full resize-y rounded-none border border-input bg-transparent px-2.5 py-2 font-sans text-xs leading-relaxed outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30"
        placeholder={
          !replyRequired
            ? "InboxIQ didn't draft this — write a reply if you'd still like to send one."
            : aiConfigured
              ? "Click Regenerate to draft a reply, or write your own here."
              : aiReason === "disabled"
                ? "Write your reply here. (AI drafting is disabled for this deployment.)"
                : "Write your reply here. (Set OPENROUTER_API_KEY to enable AI drafting.)"
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          onClick={handleSend}
          disabled={pending || body.trim().length === 0}
        >
          <Send className="size-3.5" />
          {pending && status.kind === "idle" ? "Sending..." : "Send reply"}
        </Button>

        <Button
          type="button"
          variant="outline"
          onClick={() => handleRegenerate(null)}
          disabled={pending || !aiConfigured}
          title={
            !aiConfigured && aiReason === "disabled"
              ? "AI is disabled for this deployment."
              : !aiConfigured && aiReason === "missing"
                ? "Set OPENROUTER_API_KEY in .env.local."
                : undefined
          }
        >
          <RefreshCw className={pending ? "size-3.5 animate-spin" : "size-3.5"} />
          Regenerate
        </Button>
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground">Tone:</span>
          {TONES.map((t) => (
            <Button
              key={t.value}
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => handleRegenerate(t.value)}
              disabled={pending || !aiConfigured}
              title={
                !aiConfigured && aiReason === "disabled"
                  ? "AI is disabled for this deployment."
                  : undefined
              }
            >
              {t.label}
            </Button>
          ))}
        </div>
      </div>

      {!aiConfigured && aiReason === "disabled" ? (
        <span className="inline-flex items-center gap-1.5 border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-xs text-amber-700 dark:text-amber-400">
          <AlertTriangle className="size-3" />
          AI is disabled for this deployment.
        </span>
      ) : null}

      {status.kind === "sent" ? (
        <p className="text-xs text-muted-foreground">
          Reply sent. Gmail message id: <code>{status.messageId}</code>.
        </p>
      ) : null}
      {status.kind === "regenerated" ? (
        <p className="text-xs text-muted-foreground">
          Draft regenerated. Edit before sending if needed.
        </p>
      ) : null}
      {status.kind === "error" ? (
        <p className="text-xs text-destructive">
          {status.error}
          {status.reauth ? " — reconnect Gmail in the dashboard." : ""}
        </p>
      ) : null}
      {alreadyReplied && status.kind !== "sent" ? (
        <p className="text-xs text-muted-foreground">
          You&apos;ve already sent a reply to this thread from InboxIQ.
        </p>
      ) : null}
    </div>
  )
}
