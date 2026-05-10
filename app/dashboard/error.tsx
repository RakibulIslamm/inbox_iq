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

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("[dashboard error-boundary]", error)
  }, [error])

  return (
    <div className="mx-auto w-full max-w-md px-4 py-12">
      <Card>
        <CardHeader>
          <AlertOctagon className="size-5 text-destructive" />
          <CardTitle className="mt-2">Couldn&apos;t load the dashboard.</CardTitle>
          <CardDescription>
            {error.message ||
              "Something went wrong reading your data. This is usually transient."}
            {error.digest ? (
              <span className="mt-1 block text-[10px] uppercase tracking-wide">
                ref · {error.digest}
              </span>
            ) : null}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Button onClick={reset} variant="outline" size="sm">
            Retry
          </Button>
          <Link href="/" className={buttonVariants({ size: "sm" })}>
            Home
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
