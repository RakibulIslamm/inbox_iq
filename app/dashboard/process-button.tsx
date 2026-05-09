"use client"

import { useActionState } from "react"
import { Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { processEmails, type ProcessResult } from "@/app/actions/process"

const INITIAL: ProcessResult | null = null

async function runProcess(): Promise<ProcessResult> {
  return processEmails()
}

export function ProcessButton() {
  const [state, action, pending] = useActionState(runProcess, INITIAL)

  return (
    <form action={action} className="flex flex-col gap-2">
      <Button type="submit" variant="secondary" disabled={pending}>
        <Sparkles className={pending ? "size-3.5 animate-pulse" : "size-3.5"} />
        {pending ? "Classifying..." : "Process emails"}
      </Button>

      {state?.ok ? (
        <p className="text-xs text-muted-foreground">
          Classified {state.processed}{" "}
          {state.processed === 1 ? "email" : "emails"}
          {state.failed > 0 ? ` (${state.failed} failed)` : ""}
          {state.remaining !== null
            ? ` · ${state.remaining} left in today's free quota`
            : ""}
          .
        </p>
      ) : null}
      {state && !state.ok ? (
        <p className="text-xs text-destructive">{state.error}</p>
      ) : null}
    </form>
  )
}
