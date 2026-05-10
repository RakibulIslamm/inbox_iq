import { getGmailClient, GmailReauthRequiredError, isReauthRequiredError } from "./client"

export type ReplyInput = {
  /** The replier's user id (for the OAuth client lookup). */
  userId: string
  /** The original sender, in any RFC 2822 format. We extract the address. */
  to: string
  /** Original subject — "Re: " is prepended if it isn't already. */
  originalSubject: string | null
  /** RFC 2822 Message-ID header of the original (for In-Reply-To/References). */
  inReplyTo: string | null
  /** Gmail thread id of the original (for proper Gmail threading). */
  threadId: string | null
  /** The plaintext reply body. */
  body: string
}

export type SendReplyResult = {
  /** Gmail's API message id of the sent reply. */
  messageId: string
  /** The thread id (echoed from the request or assigned by Gmail). */
  threadId: string | null
}

/**
 * Send a reply via the authenticated user's Gmail account. Builds a minimal
 * RFC 2822 message, base64url-encodes it, and POSTs through `messages.send`.
 *
 * Requires the `gmail.send` scope — users who connected before Phase 4 must
 * reconnect to grant it.
 */
export async function sendReply(input: ReplyInput): Promise<SendReplyResult> {
  const gmail = await getGmailClient(input.userId)

  const recipient = extractAddress(input.to)
  if (!recipient) {
    throw new Error("Could not parse recipient address.")
  }

  const subject = ensureReSubject(input.originalSubject)
  const raw = buildRfc2822({
    to: recipient,
    subject,
    inReplyTo: input.inReplyTo,
    body: input.body,
  })

  try {
    const res = await gmail.users.messages.send({
      userId: "me",
      requestBody: {
        raw,
        threadId: input.threadId ?? undefined,
      },
    })
    return {
      messageId: res.data.id ?? "",
      threadId: res.data.threadId ?? null,
    }
  } catch (e) {
    if (isReauthRequiredError(e)) throw new GmailReauthRequiredError(e)
    throw e
  }
}

/**
 * "Foo Bar <foo@bar.com>" → "foo@bar.com"
 * "foo@bar.com" → "foo@bar.com"
 * Returns null if no email shape can be found.
 */
export function extractAddress(input: string): string | null {
  const angle = input.match(/<([^>]+)>/)
  if (angle) return angle[1].trim()
  const bare = input.match(/[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}/)
  return bare ? bare[0] : null
}

function ensureReSubject(subject: string | null): string {
  const trimmed = (subject ?? "").trim()
  if (!trimmed) return "Re: (no subject)"
  return /^re:\s/i.test(trimmed) ? trimmed : `Re: ${trimmed}`
}

function buildRfc2822({
  to,
  subject,
  inReplyTo,
  body,
}: {
  to: string
  subject: string
  inReplyTo: string | null
  body: string
}): string {
  // Encode the subject as RFC 2047 if it contains non-ASCII so Gmail handles
  // unicode correctly.
  const encodedSubject = needsRfc2047(subject)
    ? `=?UTF-8?B?${Buffer.from(subject, "utf8").toString("base64")}?=`
    : subject

  const headers = [
    `To: ${to}`,
    `Subject: ${encodedSubject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 7bit",
  ]
  if (inReplyTo) {
    headers.push(`In-Reply-To: ${inReplyTo}`)
    headers.push(`References: ${inReplyTo}`)
  }

  // RFC 2822 line-ending is CRLF.
  const message = `${headers.join("\r\n")}\r\n\r\n${body}`
  return Buffer.from(message, "utf8").toString("base64url")
}

function needsRfc2047(s: string): boolean {
  // Quick heuristic: any byte above 0x7F means non-ASCII.
  for (let i = 0; i < s.length; i++) {
    if (s.charCodeAt(i) > 0x7f) return true
  }
  return false
}
