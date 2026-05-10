import type { gmail_v1 } from "googleapis"
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  getGmailClient,
  GmailReauthRequiredError,
  isReauthRequiredError,
} from "./client"

export type SimplifiedEmail = {
  gmailMessageId: string
  threadId: string | null
  messageIdHeader: string | null
  subject: string | null
  sender: string | null
  to: string | null
  cc: string | null
  snippet: string | null
  body: string | null
  receivedAt: Date | null
}

const MAX_BODY_CHARS = 50_000

export type FetchEmailsOptions = {
  /**
   * Cap the total number of messages returned across pages. The cron sync
   * leaves this null/undefined to grab everything since the watermark; the
   * manual "Sync now" button passes a small cap (e.g. 200) so a stale user
   * doesn't trigger a multi-thousand-message fetch on first click.
   */
  limit?: number | null
  /**
   * Watermark — only fetch messages received after this Date. Translated to
   * Gmail's `q: "after:<unix>"` filter. Pass null/undefined for a full pull
   * of the most recent messages (the first sync after a fresh connection).
   */
  since?: Date | null
}

/**
 * Fetch inbox messages for a user, returning a simplified shape ready to
 * upsert into the `emails` table. Skips drafts/sent by targeting INBOX
 * only. Paginates internally so callers don't have to think about Gmail's
 * 500-per-page cap.
 */
export async function fetchRecentEmails(
  userId: string,
  options: FetchEmailsOptions = {},
  supabase?: SupabaseClient
): Promise<SimplifiedEmail[]> {
  const gmail = await getGmailClient(userId, supabase)

  const limit = options.limit ?? null
  const since = options.since ?? null
  // Gmail accepts a unix timestamp in seconds.
  const sinceQuery = since ? `after:${Math.floor(since.getTime() / 1000)}` : undefined

  const ids: string[] = []
  let pageToken: string | undefined = undefined
  // Gmail's hard ceiling per page is 500; we ask for less to keep responses snappy.
  const PAGE_SIZE = 100

  try {
    do {
      const remaining = limit !== null ? Math.max(0, limit - ids.length) : null
      if (remaining === 0) break
      const requestedThisPage =
        remaining !== null ? Math.min(PAGE_SIZE, remaining) : PAGE_SIZE

      const listRes = await gmail.users.messages.list({
        userId: "me",
        maxResults: requestedThisPage,
        labelIds: ["INBOX"],
        ...(sinceQuery ? { q: sinceQuery } : {}),
        ...(pageToken ? { pageToken } : {}),
      })
      const data: gmail_v1.Schema$ListMessagesResponse = listRes.data
      const pageIds = (data.messages ?? [])
        .map((m: gmail_v1.Schema$Message) => m.id)
        .filter((id): id is string => Boolean(id))
      ids.push(...pageIds)
      pageToken = data.nextPageToken ?? undefined
    } while (pageToken && (limit === null || ids.length < limit))
  } catch (e) {
    if (isReauthRequiredError(e)) throw new GmailReauthRequiredError(e)
    throw e
  }

  if (ids.length === 0) return []

  // Fetch full message bodies in parallel-ish batches so we don't open
  // hundreds of concurrent connections to Gmail when the page is large.
  const FETCH_CONCURRENCY = 8
  const results: (SimplifiedEmail | null)[] = new Array(ids.length)
  let cursor = 0
  await Promise.all(
    Array.from({ length: Math.min(FETCH_CONCURRENCY, ids.length) }, async () => {
      while (true) {
        const i = cursor++
        if (i >= ids.length) return
        const id = ids[i]
        try {
          const res = await gmail.users.messages.get({
            userId: "me",
            id,
            format: "full",
          })
          results[i] = parseEmailMessage(res.data)
        } catch (e) {
          if (isReauthRequiredError(e)) throw new GmailReauthRequiredError(e)
          console.warn(`[gmail] failed to fetch message ${id}`, e)
          results[i] = null
        }
      }
    })
  )

  return results.filter((m): m is SimplifiedEmail => m !== null)
}

function parseEmailMessage(msg: gmail_v1.Schema$Message): SimplifiedEmail | null {
  if (!msg.id) return null

  const headers = msg.payload?.headers ?? []
  const getHeader = (name: string) =>
    headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? null

  const subject = getHeader("Subject")
  const sender = getHeader("From")
  const to = getHeader("To")
  const cc = getHeader("Cc")
  const messageIdHeader = getHeader("Message-ID") ?? getHeader("Message-Id")
  const dateHeader = getHeader("Date")
  const internalDate = msg.internalDate ? Number(msg.internalDate) : null

  const receivedAt = dateHeader
    ? new Date(dateHeader)
    : internalDate
      ? new Date(internalDate)
      : null

  const rawBody = msg.payload ? extractBody(msg.payload) : null
  const body = rawBody ? rawBody.slice(0, MAX_BODY_CHARS) : null

  return {
    gmailMessageId: msg.id,
    threadId: msg.threadId ?? null,
    messageIdHeader,
    subject,
    sender,
    to,
    cc,
    snippet: msg.snippet ?? null,
    body,
    receivedAt: receivedAt && !isNaN(receivedAt.getTime()) ? receivedAt : null,
  }
}

/**
 * Walk the MIME tree, preferring text/plain and falling back to text/html.
 * Returns the decoded body or null if no readable part is found.
 */
function extractBody(payload: gmail_v1.Schema$MessagePart): string | null {
  const plain = findPart(payload, "text/plain")
  if (plain) return decodePart(plain)
  const html = findPart(payload, "text/html")
  if (html) return stripHtml(decodePart(html) ?? "")
  return null
}

function findPart(
  part: gmail_v1.Schema$MessagePart,
  mimeType: string
): gmail_v1.Schema$MessagePart | null {
  if (part.mimeType === mimeType && part.body?.data) return part
  for (const sub of part.parts ?? []) {
    const found = findPart(sub, mimeType)
    if (found) return found
  }
  return null
}

function decodePart(part: gmail_v1.Schema$MessagePart): string | null {
  const data = part.body?.data
  if (!data) return null
  // Gmail returns base64url-encoded body data.
  return Buffer.from(data, "base64url").toString("utf8")
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim()
}
