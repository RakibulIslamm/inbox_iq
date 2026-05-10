import { NextResponse, type NextRequest } from "next/server"
import { syncAndClassifyForUser } from "@/lib/cron/sync-for-user"
import { readAIEnv } from "@/lib/ai/env"
import { readGmailEnv } from "@/lib/gmail/env"
import { createAdminClient } from "@/lib/supabase/admin"

/**
 * Vercel Cron — twice daily (configured in vercel.json).
 *
 * Iterates every user with a Gmail connection, runs an incremental sync
 * (Gmail `q: "after:<unix>"` since their `profiles.last_synced_at`
 * watermark) and classifies the unprocessed emails up to the user's plan
 * quota.
 *
 * Per-user failures are logged but don't fail the whole run, so one user's
 * expired refresh token doesn't poison the rest.
 */
export const maxDuration = 300 // seconds — sync + classify can be slow.

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

  if (!readGmailEnv().configured) {
    return NextResponse.json(
      { ok: false, error: "Gmail OAuth not configured." },
      { status: 500 }
    )
  }
  if (!readAIEnv().configured) {
    return NextResponse.json(
      { ok: false, error: "OpenRouter not configured." },
      { status: 500 }
    )
  }

  const admin = createAdminClient()

  const { data: connections, error: connError } = await admin
    .from("gmail_connections")
    .select("user_id")
  if (connError) {
    return NextResponse.json(
      { ok: false, error: connError.message },
      { status: 500 }
    )
  }

  const userIds = Array.from(
    new Set((connections ?? []).map((c) => c.user_id as string))
  )

  // Sequential per user to avoid hammering Gmail / OpenRouter when there
  // are many connections; parallelism inside each user is enough to keep
  // single-user runs fast.
  const results = []
  for (const userId of userIds) {
    try {
      const r = await syncAndClassifyForUser(userId, admin)
      results.push(r)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error(`[cron] sync threw for ${userId}:`, msg)
      results.push({
        userId,
        ok: false,
        ingested: 0,
        classified: 0,
        failedClassifications: 0,
        error: msg,
      })
    }
  }

  const totals = results.reduce(
    (acc, r) => ({
      ingested: acc.ingested + r.ingested,
      classified: acc.classified + r.classified,
      failedClassifications: acc.failedClassifications + r.failedClassifications,
      ok: acc.ok + (r.ok ? 1 : 0),
      failed: acc.failed + (r.ok ? 0 : 1),
    }),
    { ingested: 0, classified: 0, failedClassifications: 0, ok: 0, failed: 0 }
  )

  return NextResponse.json({
    ok: true,
    users: userIds.length,
    totals,
    results,
  })
}
