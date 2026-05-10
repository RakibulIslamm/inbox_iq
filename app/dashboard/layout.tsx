import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { CalendarDays, CreditCard, Inbox, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SetupRequired } from "@/components/setup-required"
import { ThemeToggle } from "@/components/theme-toggle"
import { signOut } from "@/app/actions/sign-out"
import { pickDisplayName } from "@/lib/display"
import { readSupabaseEnv } from "@/lib/supabase/env"
import { createClient } from "@/lib/supabase/server"

export const metadata: Metadata = {
  title: { default: "Dashboard", template: "%s · InboxIQ" },
  // Dashboard pages are private — keep them out of search results.
  robots: { index: false, follow: false },
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  if (!readSupabaseEnv().configured) {
    return <SetupRequired />
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("name")
    .eq("id", user.id)
    .maybeSingle()

  const displayName = pickDisplayName({
    profileName: profile?.name ?? null,
    metadataFullName:
      (user.user_metadata?.full_name as string | undefined) ??
      (user.user_metadata?.name as string | undefined) ??
      null,
    email: user.email,
  })

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center gap-4 border-b border-border px-4 py-3">
        {/* Left: brand */}
        <Link
          href="/dashboard"
          className="flex shrink-0 items-center gap-2 text-sm font-medium"
        >
          <Inbox className="size-4" />
          <span>InboxIQ</span>
        </Link>

        {/* Center: nav (flex-1 + justify-center) */}
        <nav className="flex flex-1 items-center justify-center gap-4 text-xs">
          <Link
            href="/dashboard"
            className="text-muted-foreground hover:text-foreground"
          >
            Inbox
          </Link>
          <Link
            href="/dashboard/today"
            className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
          >
            <CalendarDays className="size-3" />
            Today
          </Link>
          <Link
            href="/dashboard/billing"
            className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
          >
            <CreditCard className="size-3" />
            Billing
          </Link>
        </nav>

        {/* Right: user info */}
        <div className="flex shrink-0 items-center gap-2">
          <span
            className="hidden text-xs font-medium sm:inline"
            title={user.email ?? undefined}
          >
            {displayName}
          </span>
          <ThemeToggle />
          <form action={signOut}>
            <Button type="submit" variant="ghost" size="sm">
              <LogOut className="size-3.5" />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </form>
        </div>
      </header>

      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  )
}
