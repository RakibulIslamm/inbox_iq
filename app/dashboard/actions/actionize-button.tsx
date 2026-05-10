"use client"

import { useActionState, useEffect, useRef } from "react"
import Link from "next/link"
import { Sparkles, Zap } from "lucide-react"
import { toast } from "sonner"
import { Button, buttonVariants } from "@/components/ui/button"
import { actionizeEmails, type ActionizeResult } from "@/app/actions/actionize"

const INITIAL: ActionizeResult | null = null

async function runActionize(): Promise<ActionizeResult> {
  return actionizeEmails()
}

export function ActionizeButton({
  disabled = false,
  disabledReason,
}: {
  disabled?: boolean
  disabledReason?: string
} = {}) {
  const [state, action, pending] = useActionState(runActionize, INITIAL)
  const lastReported = useRef<ActionizeResult | null>(null)

  useEffect(() => {
    if (!state || state === lastReported.current) return
    lastReported.current = state
    if (state.ok) {
      const desc =
        state.remaining !== null
          ? `${state.remaining} left in today's free quota.`
          : undefined
      toast.success(
        `Categorized ${state.processed} ${state.processed === 1 ? "email" : "emails"}.`,
        desc ? { description: desc } : undefined
      )
    } else if (state.quotaExceeded) {
      toast.error(state.error, {
        description: "Upgrade to Pro for unlimited categorization.",
      })
    } else {
      toast.error(state.error)
    }
  }, [state])

  return (
    <form action={action} className="flex flex-col gap-2">
      <Button
        type="submit"
        variant="secondary"
        disabled={pending || disabled}
        title={disabled ? disabledReason : undefined}
      >
        <Sparkles className={pending ? "size-3.5 animate-pulse" : "size-3.5"} />
        {pending ? "Categorizing..." : "Categorize actions"}
      </Button>

      {state && !state.ok && state.quotaExceeded ? (
        <div className="space-y-2 border border-destructive/40 px-3 py-2">
          <p className="flex items-center gap-1.5 text-xs text-destructive">
            <Zap className="size-3.5" />
            {state.error}
          </p>
          <Link
            href="/dashboard/billing"
            className={buttonVariants({ size: "xs" })}
          >
            Upgrade to Pro — $19/mo
          </Link>
        </div>
      ) : null}
    </form>
  )
}
