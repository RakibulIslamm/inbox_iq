import type { NextRequest } from "next/server"
import { updateSession } from "@/lib/supabase/middleware"

export async function proxy(request: NextRequest) {
  return updateSession(request)
}

export const config = {
  matcher: [
    // Skip all internal Next paths (HMR, _next/data, _next/static, _next/image),
    // favicon, and any static asset extension. Keeps Supabase session refresh
    // off the hot path for assets and HMR pings.
    "/((?!_next/|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?|ttf|otf|eot|map)$).*)",
  ],
}
