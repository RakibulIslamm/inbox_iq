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

/**
 * Fetch the most recent inbox messages for a user, returning a simplified
 * shape ready to upsert into the `emails` table. Skips drafts/sent by
 * targeting `INBOX` only.
 */
export async function fetchRecentEmails(
  userId: string,
  limit = 50,
  supabase?: SupabaseClient
): Promise<SimplifiedEmail[]> {
  const gmail = await getGmailClient(userId, supabase)

  let listResponse: gmail_v1.Schema$ListMessagesResponse
  try {
    const res = await gmail.users.messages.list({
      userId: "me",
      maxResults: limit,
      labelIds: ["INBOX"],
    })
    listResponse = res.data
  } catch (e) {
    if (isReauthRequiredError(e)) throw new GmailReauthRequiredError(e)
    throw e
  }

  const ids = (listResponse.messages ?? []).map((m) => m.id).filter(Boolean) as string[]
  if (ids.length === 0) return []

  const messages = await Promise.all(
    ids.map(async (id) => {
      try {
        const res = await gmail.users.messages.get({
          userId: "me",
          id,
          format: "full",
        })
        return parseEmailMessage(res.data)
      } catch (e) {
        if (isReauthRequiredError(e)) throw new GmailReauthRequiredError(e)
        // Skip individual broken messages rather than failing the whole sync.
        console.warn(`[gmail] failed to fetch message ${id}`, e)
        return null
      }
    })
  )

  return messages.filter((m): m is SimplifiedEmail => m !== null)
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
