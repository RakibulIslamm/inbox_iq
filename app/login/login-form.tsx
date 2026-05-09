"use client"

import { useActionState } from "react"
import { Mail } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import {
  signInWithGoogle,
  signInWithMagicLink,
  type MagicLinkState,
} from "@/app/actions/auth"

export function LoginForm({ initialError }: { initialError?: string }) {
  const [state, formAction, pending] = useActionState<MagicLinkState, FormData>(
    signInWithMagicLink,
    {}
  )

  const errorMessage = state.error ?? initialError

  return (
    <div className="space-y-4">
      <form action={formAction} className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            required
            disabled={pending}
          />
        </div>

        <Button type="submit" disabled={pending} className="w-full">
          <Mail className="size-3.5" />
          {pending ? "Sending..." : "Send magic link"}
        </Button>

        {state.ok && state.message ? (
          <p className="text-xs text-muted-foreground">{state.message}</p>
        ) : null}
        {errorMessage ? (
          <p className="text-xs text-destructive">{errorMessage}</p>
        ) : null}
      </form>

      <div className="flex items-center gap-3">
        <Separator className="flex-1" />
        <span className="text-xs text-muted-foreground">or</span>
        <Separator className="flex-1" />
      </div>

      <form action={signInWithGoogle}>
        <Button type="submit" variant="outline" className="w-full">
          <GoogleIcon />
          Continue with Google
        </Button>
      </form>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-3.5"
      fill="currentColor"
    >
      <path d="M21.35 11.1H12v3.2h5.35c-.23 1.43-1.66 4.2-5.35 4.2-3.22 0-5.85-2.66-5.85-5.95s2.63-5.95 5.85-5.95c1.83 0 3.06.78 3.76 1.45l2.56-2.47C16.7 4.1 14.55 3.1 12 3.1 6.94 3.1 2.85 7.2 2.85 12.25S6.94 21.4 12 21.4c6.93 0 9.15-4.86 9.15-7.36 0-.49-.05-.86-.13-1.24z" />
    </svg>
  )
}
