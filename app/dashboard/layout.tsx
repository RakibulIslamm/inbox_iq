import Link from "next/link"
import { redirect } from "next/navigation"
import { Inbox, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SetupRequired } from "@/components/setup-required"
import { signOut } from "@/app/actions/sign-out"
import { readSupabaseEnv } from "@/lib/supabase/env"
import { createClient } from "@/lib/supabase/server"

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
        <Link href="/dashboard" className="flex items-center gap-2 text-sm font-medium">
          <Inbox className="size-4" />
          <span>InboxIQ</span>
        </Link>

        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">{user.email}</span>
          <form action={signOut}>
            <Button type="submit" variant="ghost" size="sm">
              <LogOut className="size-3.5" />
              Sign out
            </Button>
          </form>
        </div>
      </header>

      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  )
}
