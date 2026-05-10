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
      toast.success(
        `Synced ${state.synced} ${state.synced === 1 ? "email" : "emails"}.`,
        state.skipped > 0
          ? { description: `Skipped ${state.skipped} unparseable.` }
          : undefined
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
