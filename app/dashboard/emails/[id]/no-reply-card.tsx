"use client"

import { useState } from "react"
import { MailX } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { NoReplyReason } from "@/lib/ai/agents/classifier"
import { ReplyForm } from "./reply-form"

const REASON_COPY: Record<NoReplyReason, string> = {
  no_reply_sender: "a no-reply sender",
  automated: "an automated alert",
  fyi: "an FYI message",
  newsletter: "a newsletter",
  marketing: "marketing",
  receipt: "a receipt",
}

export function NoReplyCard({
  emailId,
  noReplyReason,
  initialDraft,
  alreadyReplied,
  aiConfigured,
  aiReason,
}: {
  emailId: number
  noReplyReason: NoReplyReason | null
  initialDraft: string
  alreadyReplied: boolean
  aiConfigured: boolean
  aiReason: "disabled" | "missing" | null
}) {
  const [expanded, setExpanded] = useState(false)
  const reasonLabel = noReplyReason
    ? REASON_COPY[noReplyReason]
    : "an automated message"

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <MailX className="size-4" />
            <CardTitle>No reply needed</CardTitle>
          </div>
          {!expanded ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setExpanded(true)}
            >
              Reply anyway
            </Button>
          ) : null}
        </div>
        <CardDescription>
          This email looks like {reasonLabel}. InboxIQ skipped drafting a
          response.
        </CardDescription>
      </CardHeader>
      {expanded ? (
        <CardContent>
          <ReplyForm
            emailId={emailId}
            initialDraft={initialDraft}
            alreadyReplied={alreadyReplied}
            aiConfigured={aiConfigured}
            aiReason={aiReason}
            replyRequired={false}
            noReplyReason={noReplyReason}
          />
        </CardContent>
      ) : null}
    </Card>
  )
}
