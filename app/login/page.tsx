import Link from "next/link"
import { redirect } from "next/navigation"
import { Inbox } from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { SetupRequired } from "@/components/setup-required"
import { readSupabaseEnv } from "@/lib/supabase/env"
import { createClient } from "@/lib/supabase/server"
import { LoginForm } from "./login-form"

type SearchParams = Promise<{ error?: string; redirect?: string }>

export default async function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  if (!readSupabaseEnv().configured) {
    return <SetupRequired />
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    redirect("/dashboard")
  }

  const { error } = await searchParams

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm space-y-6">
        <Link
          href="/"
          className="flex items-center justify-center gap-2 text-sm font-medium"
        >
          <Inbox className="size-4" />
          <span>InboxIQ</span>
        </Link>

        <Card>
          <CardHeader>
            <CardTitle>Sign in to InboxIQ</CardTitle>
            <CardDescription>
              We&apos;ll email you a magic link, or continue with Google.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LoginForm initialError={error} />
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          By continuing you agree to our terms and privacy policy.
        </p>
      </div>
    </main>
  )
}
