"use client"

import { useEffect, useState } from "react"
import { useTheme } from "next-themes"
import { Moon, Sun } from "lucide-react"
import { Button } from "@/components/ui/button"

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // Avoid SSR/CSR mismatch by waiting for mount before reading the resolved
  // theme — this is the canonical next-themes pattern. The cascading render
  // is intentional and bounded to one tick.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), [])

  const isDark = mounted && resolvedTheme === "dark"
  const next = isDark ? "light" : "dark"

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={`Switch to ${next} mode`}
      onClick={() => setTheme(next)}
    >
      {mounted ? (
        isDark ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />
      ) : (
        <Sun className="size-3.5 opacity-0" />
      )}
    </Button>
  )
}
