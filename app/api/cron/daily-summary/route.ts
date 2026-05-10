import { NextResponse, type NextRequest } from "next/server"
import { generateDailySummaryFor } from "@/app/actions/summary"
import { readAIEnv } from "@/lib/ai/env"
import { createAdminClient } from "@/lib/supabase/admin"

/**
 * Vercel Cron — runs daily at 08:00 UTC (configured in vercel.json).
 *
 * Vercel sends `Authorization: Bearer ${CRON_SECRET}`. We accept that header
 * OR a `?secret=...` query param (handy for local curl testing).
 *
 * Iterates every user with at least one classified email today and writes a
 * `daily_summaries` row each. Per-user failures are logged but don't fail
 * the whole run.
 */
export async function GET(request: NextRequest) {
  const expected = process.env.CRON_SECRET
  if (!expected) {
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET not set." },
      { status: 500 }
    )
  }

  const authHeader = request.headers.get("authorization")
  const authQuery = new URL(request.url).searchParams.get("secret")
  const provided =
    authHeader?.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length).trim()
      : authQuery
  if (provided !== expected) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 })
  }

  if (!readAIEnv().configured) {
    return NextResponse.json(
      { ok: false, error: "OpenRouter not configured." },
      { status: 500 }
    )
  }

  const admin = createAdminClient()

  // Find users who have at least one AI-classified email today.
  const dayStart = new Date()
  dayStart.setUTCHours(0, 0, 0, 0)

  const { data: rows, error } = await admin
    .from("emails")
    .select("user_id")
    .not("category", "is", null)
    .gte("processed_at", dayStart.toISOString())

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    )
  }

  const userIds = Array.from(new Set((rows ?? []).map((r) => r.user_id as string)))

  const results = await Promise.allSettled(
    userIds.map(async (userId) => {
      const res = await generateDailySummaryFor(userId, admin)
      return { userId, res }
    })
  )

  const succeeded: string[] = []
  const failed: { userId: string; error: string }[] = []
  results.forEach((r, i) => {
    const userId = userIds[i]
    if (r.status === "rejected") {
      failed.push({
        userId,
        error: r.reason instanceof Error ? r.reason.message : String(r.reason),
      })
      return
    }
    const res = r.value.res
    if (res.ok) {
      succeeded.push(userId)
    } else {
      failed.push({ userId, error: res.error })
    }
  })

  return NextResponse.json({
    ok: true,
    usersScanned: userIds.length,
    succeeded: succeeded.length,
    failed,
  })
}
