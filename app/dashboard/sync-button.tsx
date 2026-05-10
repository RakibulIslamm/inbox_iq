"use client"

import { useEffect, useRef } from "react"
import { useActionState } from "react"
import { RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { syncEmails, type SyncResult } from "@/app/actions/gmail"

const INITIAL: SyncResult | null = null

async function runSync(): Promise<SyncResult> {
  return syncEmails()
}

export function SyncButton() {
  const [state, action, pending] = useActionState(runSync, INITIAL)
  const lastReported = useRef<SyncResult | null>(null)

  useEffect(() => {
    if (!state || state === lastReported.current) return
    lastReported.current = state
    if (state.ok) {
      // Build a description that explains the sync→process gap. The common
      // confusion: "Synced 5" but Process says "Classified 0" because the 5
      // were already-classified duplicates. Now we say so up front.
      const headline =
        state.synced > 0
          ? `Synced ${state.synced} new ${state.synced === 1 ? "email" : "emails"}.`
          : state.updated > 0
            ? `No new emails — ${state.updated} already in inbox.`
            : "No new emails."
      const parts: string[] = []
      if (state.unprocessed > 0) {
        parts.push(
          `${state.unprocessed} ready to process`
        )
      } else if (state.synced === 0 && state.updated > 0) {
        parts.push("Everything is already classified")
      }
      if (state.skipped > 0) parts.push(`${state.skipped} unparseable`)
      toast.success(
        headline,
        parts.length > 0 ? { description: parts.join(" · ") } : undefined
      )
    } else {
      toast.error(state.error)
    }
  }, [state])

  return (
    <form action={action} className="flex flex-col gap-2">
      <Button type="submit" disabled={pending}>
        <RefreshCw className={pending ? "size-3.5 animate-spin" : "size-3.5"} />
        {pending ? "Syncing..." : "Sync emails"}
      </Button>
    </form>
  )
}
