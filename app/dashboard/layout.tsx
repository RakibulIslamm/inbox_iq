import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { CalendarDays, CreditCard, Inbox, InboxIcon, LayoutDashboard, LogOut } from "lucide-react"
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
      <header className="relative flex items-center justify-between gap-4 border-b border-border px-4 py-3">
        {/* Left: brand */}
        <Link
          href="/dashboard"
          className="flex shrink-0 items-center gap-2 text-sm font-medium"
        >
          <Inbox className="size-4" />
          <span>InboxIQ</span>
        </Link>

        {/*
          Center: nav — absolutely positioned at the viewport center so the
          links sit at the canvas midpoint regardless of how wide the left
          (brand) or right (user-info) clusters are. Hidden on small screens
          where there isn't room to overlap; falls back to a compact layout
          beneath the header on mobile.
        */}
        <nav className="pointer-events-none absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 items-center gap-4 text-xs sm:flex">
          <Link
            href="/dashboard"
            className="pointer-events-auto flex items-center gap-1 text-muted-foreground hover:text-foreground"
          >
            <LayoutDashboard className="size-3" />
            Inbox
          </Link>
          <Link
            href="/dashboard/today"
            className="pointer-events-auto flex items-center gap-1 text-muted-foreground hover:text-foreground"
          >
            <CalendarDays className="size-3" />
            Today
          </Link>
          <Link
            href="/dashboard/billing"
            className="pointer-events-auto flex items-center gap-1 text-muted-foreground hover:text-foreground"
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

      {/* Mobile nav — visible only when the absolute nav above is hidden. */}
      <nav className="flex items-center justify-center gap-4 border-b border-border px-4 py-2 text-xs sm:hidden">
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

      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  )
}
