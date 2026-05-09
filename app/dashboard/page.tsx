import { AlertTriangle, CheckCircle2, Mail, Unplug } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { disconnectGmail } from "@/app/actions/gmail"
import { readGmailEnv } from "@/lib/gmail/env"
import { createClient } from "@/lib/supabase/server"
import { SyncButton } from "./sync-button"

type SearchParams = Promise<{ gmail?: string; gmail_error?: string }>

const ERROR_MESSAGES: Record<string, string> = {
  gmail_not_configured:
    "Gmail OAuth credentials are missing. Add them to .env.local and restart dev.",
  state_mismatch:
    "OAuth state didn't match. Try connecting again from this tab.",
  missing_params: "Google didn't return an authorization code. Try again.",
  exchange_failed: "Couldn't exchange the OAuth code with Google. Try again.",
  no_refresh_token:
    "Google didn't return a refresh token. Revoke the app at myaccount.google.com/permissions and reconnect.",
  persist_failed: "Authorized with Google but couldn't save the connection. Try again.",
  access_denied: "You declined the consent screen. Connect when ready.",
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const params = await searchParams
  const gmailConfigured = readGmailEnv().configured

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  // Layout already enforced auth, so user is non-null here, but TS doesn't know.
  if (!user) return null

  const { data: connection } = await supabase
    .from("gmail_connections")
    .select("user_id, created_at")
    .eq("user_id", user.id)
    .maybeSingle()

  const connected = Boolean(connection)

  const { data: emails } = connected
    ? await supabase
        .from("emails")
        .select(
          "id, subject, sender, snippet, category, received_at, processed_at"
        )
        .eq("user_id", user.id)
        .order("received_at", { ascending: false, nullsFirst: false })
        .limit(50)
    : { data: null }

  const successMessage =
    params.gmail === "connected" ? "Gmail connected." : null
  const errorMessage = params.gmail_error
    ? ERROR_MESSAGES[params.gmail_error] ?? params.gmail_error
    : null

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-8">
      {successMessage ? (
        <StatusBanner tone="success" message={successMessage} />
      ) : null}
      {errorMessage ? (
        <StatusBanner tone="error" message={errorMessage} />
      ) : null}

      {!gmailConfigured ? (
        <GmailSetupCard />
      ) : connected ? (
        <ConnectedCard />
      ) : (
        <ConnectCard />
      )}

      {connected ? <EmailList emails={emails ?? []} /> : null}
    </div>
  )
}

function StatusBanner({
  tone,
  message,
}: {
  tone: "success" | "error"
  message: string
}) {
  const Icon = tone === "success" ? CheckCircle2 : AlertTriangle
  const className =
    tone === "success"
      ? "border-foreground/20 text-foreground"
      : "border-destructive/40 text-destructive"
  return (
    <div
      className={`flex items-start gap-2 border px-3 py-2 text-xs ${className}`}
    >
      <Icon className="mt-0.5 size-3.5 shrink-0" />
      <span>{message}</span>
    </div>
  )
}

function GmailSetupCard() {
  return (
    <Card>
      <CardHeader>
        <AlertTriangle className="size-4 text-destructive" />
        <CardTitle className="mt-2">Gmail OAuth not configured</CardTitle>
        <CardDescription>
          Set <code className="rounded bg-muted px-1">GOOGLE_CLIENT_ID</code>,{" "}
          <code className="rounded bg-muted px-1">GOOGLE_CLIENT_SECRET</code>,
          and <code className="rounded bg-muted px-1">GOOGLE_REDIRECT_URI</code>{" "}
          in <code className="rounded bg-muted px-1">.env.local</code> and
          restart dev.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground">
          See the README for the full setup steps (Google Cloud OAuth client,
          consent screen scopes, redirect URI).
        </p>
      </CardContent>
    </Card>
  )
}

function ConnectCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Connect your Gmail</CardTitle>
        <CardDescription>
          InboxIQ needs read access to triage your inbox. We&apos;ll fetch your
          most recent 50 emails on demand.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-1.5 text-xs text-muted-foreground">
          <li>• Read-only scope (gmail.readonly)</li>
          <li>• Tokens stay encrypted in Supabase, gated by RLS</li>
          <li>• Disconnect anytime to revoke access</li>
        </ul>
      </CardContent>
      <CardFooter>
        {/* Plain <a>: this is an API route that 307s to Google. Skipping
            Next's client-side router avoids RSC-prefetch noise and ensures
            the redirect chain follows correctly. */}
        <a
          href="/api/auth/gmail/init"
          className={buttonVariants({ className: "w-full" })}
        >
          <Mail className="size-3.5" />
          Connect Gmail
        </a>
      </CardFooter>
    </Card>
  )
}

function ConnectedCard() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Gmail connected</CardTitle>
          <Badge variant="outline">
            <CheckCircle2 className="size-3" />
            Active
          </Badge>
        </div>
        <CardDescription>
          Sync to pull the most recent 50 emails. AI classification &amp;
          summaries arrive in Phase 3.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <SyncButton />

        <Separator />

        <form action={disconnectGmail}>
          <Button type="submit" variant="ghost" size="sm">
            <Unplug className="size-3.5" />
            Disconnect Gmail
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

type EmailRow = {
  id: number
  subject: string | null
  sender: string | null
  snippet: string | null
  category: string | null
  received_at: string | null
  processed_at: string
}

function EmailList({ emails }: { emails: EmailRow[] }) {
  if (emails.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Inbox</CardTitle>
          <CardDescription>
            Nothing synced yet. Click <strong>Sync emails</strong> above to
            pull your most recent 50.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Inbox · {emails.length}</CardTitle>
        <CardDescription>
          Most recent emails synced from Gmail. AI classification arrives in
          Phase 3.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        <ul className="divide-y divide-border border-y border-border">
          {emails.map((email) => (
            <EmailRow key={email.id} email={email} />
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

function EmailRow({ email }: { email: EmailRow }) {
  const date = email.received_at
    ? new Date(email.received_at)
    : new Date(email.processed_at)
  const dateLabel = date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  })

  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-xs font-medium">
            {email.sender ?? "(unknown sender)"}
          </span>
          <span className="ml-auto shrink-0 text-xs text-muted-foreground">
            {dateLabel}
          </span>
        </div>
        <p className="truncate text-xs">{email.subject ?? "(no subject)"}</p>
        {email.snippet ? (
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {email.snippet}
          </p>
        ) : null}
      </div>
      <div className="shrink-0">
        {email.category ? (
          <Badge variant="secondary">{email.category}</Badge>
        ) : (
          <Badge variant="outline">Not yet processed</Badge>
        )}
      </div>
    </li>
  )
}
