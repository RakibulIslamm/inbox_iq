"use client"

import { useEffect } from "react"
import Link from "next/link"
import { AlertOctagon } from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

/**
 * Root error boundary. Catches anything thrown in a route segment that
 * doesn't have its own `error.tsx`. The `reset()` callback re-renders the
 * boundary's children — useful for transient failures.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Surface in dev tools; in prod this can be wired to Sentry / Logtail.
    console.error("[error-boundary]", error)
  }, [error])

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <AlertOctagon className="size-5 text-destructive" />
          <CardTitle className="mt-2">Something broke.</CardTitle>
          <CardDescription>
            {error.message ||
              "An unexpected error occurred. The team has been notified."}
            {error.digest ? (
              <span className="mt-1 block text-[10px] uppercase tracking-wide">
                ref · {error.digest}
              </span>
            ) : null}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Button onClick={reset} variant="outline" size="sm">
            Try again
          </Button>
          <Link
            href="/"
            className={buttonVariants({ size: "sm" })}
          >
            Back to home
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
