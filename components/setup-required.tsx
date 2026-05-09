import Link from "next/link"
import { ArrowRight, AlertTriangle } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export function SetupRequired() {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <AlertTriangle className="size-5 text-destructive" />
          <CardTitle className="mt-2">Supabase setup required</CardTitle>
          <CardDescription>
            Auth is wired up, but your Supabase project URL and key haven&apos;t
            been added yet.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ol className="list-decimal space-y-1.5 pl-4 text-xs text-muted-foreground">
            <li>
              Create a Supabase project at{" "}
              <a
                className="underline underline-offset-2"
                href="https://supabase.com/dashboard"
                target="_blank"
                rel="noreferrer"
              >
                supabase.com/dashboard
              </a>
              .
            </li>
            <li>
              Copy{" "}
              <code className="rounded bg-muted px-1">.env.local.example</code>{" "}
              to <code className="rounded bg-muted px-1">.env.local</code>.
            </li>
            <li>
              Paste{" "}
              <code className="rounded bg-muted px-1">
                NEXT_PUBLIC_SUPABASE_URL
              </code>{" "}
              and{" "}
              <code className="rounded bg-muted px-1">
                NEXT_PUBLIC_SUPABASE_ANON_KEY
              </code>{" "}
              from <strong>Project Settings → API</strong>.
            </li>
            <li>
              Restart{" "}
              <code className="rounded bg-muted px-1">pnpm dev</code>.
            </li>
          </ol>
          <Link
            href="/"
            className={buttonVariants({
              variant: "outline",
              size: "sm",
              className: "w-full",
            })}
          >
            Back to landing
            <ArrowRight className="size-3.5" />
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
