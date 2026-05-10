import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { CalendarDays, CreditCard, Inbox, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SetupRequired } from "@/components/setup-required"
import { ThemeToggle } from "@/components/theme-toggle"
import { signOut } from "@/app/actions/sign-out"
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

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-sm font-medium"
          >
            <Inbox className="size-4" />
            <span>InboxIQ</span>
          </Link>
          <nav className="flex items-center gap-3 text-xs">
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
        </div>

        <div className="flex items-center gap-2">
          <span className="hidden text-xs text-muted-foreground sm:inline">
            {user.email}
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
