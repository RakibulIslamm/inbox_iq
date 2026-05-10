"use client"

import { useActionState, useEffect, useRef } from "react"
import { Sparkles } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  generateDailySummary,
  type GenerateSummaryResult,
} from "@/app/actions/summary"

const INITIAL: GenerateSummaryResult | null = null

async function runGenerate(): Promise<GenerateSummaryResult> {
  return generateDailySummary()
}

export function GenerateSummaryButton({
  hasExisting,
  disabled = false,
  disabledReason,
}: {
  hasExisting: boolean
  disabled?: boolean
  disabledReason?: string
}) {
  const [state, action, pending] = useActionState(runGenerate, INITIAL)
  const lastReported = useRef<GenerateSummaryResult | null>(null)

  useEffect(() => {
    if (!state || state === lastReported.current) return
    lastReported.current = state
    if (state.ok) {
      toast.success(
        `Briefing ready — ${state.emailCount} ${state.emailCount === 1 ? "email" : "emails"} summarized.`
      )
    } else {
      toast.error(state.error)
    }
  }, [state])

  return (
    <form action={action} className="flex flex-col gap-2">
      <Button
        type="submit"
        disabled={pending || disabled}
        title={disabled ? disabledReason : undefined}
      >
        <Sparkles className={pending ? "size-3.5 animate-pulse" : "size-3.5"} />
        {pending
          ? "Generating..."
          : hasExisting
            ? "Regenerate today's summary"
            : "Generate today's summary"}
      </Button>
    </form>
  )
}
