"use client"

import { useEffect, useState } from "react"

/**
 * Renders "Last synced 4m ago" and re-renders the relative time every 30
 * seconds so the label stays accurate without a page reload. Pass
 * `since` as an ISO string (the server-computed MAX(processed_at)).
 * When null, renders nothing.
 */
export function LastSync({ since }: { since: string | null }) {
  const [, setTick] = useState(0)

  useEffect(() => {
    if (!since) return
    const id = setInterval(() => setTick((n) => n + 1), 30_000)
    return () => clearInterval(id)
  }, [since])

  if (!since) return null

  const ago = formatRelative(new Date(since))
  return (
    <p className="text-xs text-muted-foreground" suppressHydrationWarning>
      Last synced {ago}.
    </p>
  )
}

function formatRelative(d: Date): string {
  const diffMs = Date.now() - d.getTime()
  if (diffMs < 0) return "just now"
  const sec = Math.floor(diffMs / 1000)
  if (sec < 30) return "just now"
  if (sec < 60) return `${sec}s ago`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const days = Math.floor(hr / 24)
  if (days < 30) return `${days}d ago`
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}
