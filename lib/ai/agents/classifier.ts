import { z } from "zod"
import { DEFAULT_AI_MODEL } from "../env"
import { createOpenRouterClient } from "../openrouter"

export const EMAIL_CATEGORIES = [
  "urgent",
  "client",
  "newsletter",
  "spam",
  "personal",
] as const

export const NO_REPLY_REASONS = [
  "no_reply_sender",
  "automated",
  "fyi",
  "newsletter",
  "marketing",
  "receipt",
] as const

export const ACTION_TYPES = [
  "reply",
  "review",
  "pay",
  "sign",
  "schedule",
  "track",
  "read",
  "none",
] as const

export type ActionType = (typeof ACTION_TYPES)[number]
export type NoReplyReason = (typeof NO_REPLY_REASONS)[number]

export const classificationSchema = z.object({
  category: z.enum(EMAIL_CATEGORIES),
  urgency_score: z.number().int().min(1).max(10),
  summary: z.string().min(1).max(500),
  action_items: z.array(z.string().min(1).max(280)).max(3),
  // null when no reply is expected (newsletters, FYI, marketing).
  draft_reply: z.string().nullable(),
  // True iff a human is genuinely waiting on the user's words.
  reply_required: z.boolean(),
  // Required when reply_required is false; null when true.
  no_reply_reason: z.enum(NO_REPLY_REASONS).nullable(),
  // Primary action category for the /dashboard/actions page.
  action_type: z.enum(ACTION_TYPES),
})

export type Classification = z.infer<typeof classificationSchema>

export type ClassifierInput = {
  subject: string | null
  sender: string | null
  body: string | null
  snippet: string | null
}

const MAX_BODY_CHARS_FOR_AI = 4000

const SYSTEM_PROMPT = `You are InboxIQ, an email triage agent.

For each email you receive, you must call the \`classify_email\` tool exactly once with these fields:

- category: one of "urgent", "client", "newsletter", "spam", "personal".
  - urgent: time-sensitive items needing action today (deadlines, outages, security alerts, missed payments, calendar conflicts).
  - client: business correspondence from customers, prospects, vendors, or work colleagues that needs a thoughtful reply but isn't time-critical.
  - newsletter: marketing, digests, product updates, automated reports — no reply expected.
  - spam: phishing, scams, unsolicited bulk mail.
  - personal: friends, family, personal accounts.

- urgency_score: integer 1–10. 10 = drop everything, 1 = ignore. Most newsletters: 1–3. Most client mail: 4–7. Genuine emergencies: 9–10.

- summary: 1–2 sentences capturing the core ask or content. No filler. Past tense, third person.

- action_items: up to 3 short, concrete tasks the recipient should take. Empty array if none. Each item is a verb phrase ("Reply with availability", "Pay invoice #4421 by Friday").

- draft_reply: a short, ready-to-send reply, OR null. Set to null for newsletters, automated alerts, and one-way notifications. When you do draft:
  - The first sentence MUST reference one specific detail from the email (a question asked, a name, a date, a number, the project mentioned). Forbidden generic openers: "Thanks for reaching out", "I've received your message", "I'll get back to you shortly", "as soon as possible".
  - Adapt length: 1–2 sentences for quick acks, 3–5 sentences for substantive client / personal mail. Never pad.
  - If the email asks a yes/no, answer it. If it asks for a time, propose one. If you don't have the info, ask exactly the question you'd need.
  - Match the sender's register and language. Plain text. No "[Your name]" placeholders.

- reply_required: true if a human is genuinely waiting on the user's words. Set false for newsletters, automated alerts, no-reply senders (the From address contains "noreply"/"no-reply"/"do-not-reply"/"notifications"/"alerts@"), shipping confirmations, receipts, marketing, and pure-FYI mail with no question. When false, draft_reply MUST be null.

- no_reply_reason: short tag explaining why no reply is needed. Required when reply_required is false; null when true. Pick the most specific one of: "no_reply_sender" (From is a no-reply mailbox), "automated" (system-generated alert/report), "fyi" (a human sent it but only to inform), "newsletter", "marketing", "receipt" (purchase/payment/shipping confirmation).

- action_type: the single primary action this email demands. Pick exactly one of:
  - reply — a human is waiting on a written response (use unless a more specific verb fits, e.g. a meeting request goes to "schedule", not "reply").
  - review — read carefully and decide; no reply yet (PR review requests, design docs, contracts to skim).
  - pay — money out (invoices, payment failures, subscription renewals, reimbursements).
  - sign — e-signature or formal acceptance (NDAs, offers, ToS).
  - schedule — calendar coordination (meeting requests, RSVPs, reschedules, time-slot polls).
  - track — passive watch (shipment, delivery, flight, order status).
  - read — read-and-file FYI worth keeping.
  - none — pure noise the user can safely ignore.

  Consistency: if reply_required is true, action_type ∈ {reply, schedule, sign, pay, review} — never "none" or "read". If reply_required is false, action_type ∈ {review, pay, sign, schedule, track, read, none}; "reply" is forbidden.

Return only via the tool call. Do not produce any other text.`

const TOOL_PARAMETERS = {
  type: "object",
  properties: {
    category: {
      type: "string",
      enum: [...EMAIL_CATEGORIES],
      description: "Best-fit category for this email.",
    },
    urgency_score: {
      type: "integer",
      minimum: 1,
      maximum: 10,
      description: "1 = ignore, 10 = drop everything.",
    },
    summary: {
      type: "string",
      description: "1–2 sentence neutral summary.",
    },
    action_items: {
      type: "array",
      items: { type: "string" },
      maxItems: 3,
      description: "Concrete tasks for the recipient. Empty if none.",
    },
    draft_reply: {
      type: ["string", "null"],
      description:
        "Ready-to-send reply, or null if no reply is expected.",
    },
    reply_required: {
      type: "boolean",
      description:
        "True iff a human is genuinely waiting on the user's words. False for newsletters, automated alerts, no-reply senders, FYI mail.",
    },
    no_reply_reason: {
      type: ["string", "null"],
      enum: [...NO_REPLY_REASONS, null],
      description:
        "Why no reply is needed. Required when reply_required is false; null when true.",
    },
    action_type: {
      type: "string",
      enum: [...ACTION_TYPES],
      description: "Primary action this email requires.",
    },
  },
  required: [
    "category",
    "urgency_score",
    "summary",
    "action_items",
    "draft_reply",
    "reply_required",
    "no_reply_reason",
    "action_type",
  ],
  additionalProperties: false,
} as const

export async function classifyEmail(
  input: ClassifierInput
): Promise<Classification> {
  const client = createOpenRouterClient()

  const completion = await client.chat.completions.create({
    model: DEFAULT_AI_MODEL,
    temperature: 0.2,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: formatEmail(input) },
    ],
    tools: [
      {
        type: "function",
        function: {
          name: "classify_email",
          description:
            "Submit a structured classification for the given email.",
          parameters: TOOL_PARAMETERS,
        },
      },
    ],
    tool_choice: {
      type: "function",
      function: { name: "classify_email" },
    },
  })

  const toolCall = completion.choices[0]?.message?.tool_calls?.[0]
  if (!toolCall || toolCall.type !== "function" || toolCall.function.name !== "classify_email") {
    throw new Error("Classifier did not return a tool call.")
  }

  let raw: unknown
  try {
    raw = JSON.parse(toolCall.function.arguments)
  } catch (e) {
    throw new Error(
      `Classifier returned invalid JSON: ${toolCall.function.arguments.slice(0, 200)}${e instanceof Error ? ` — ${e.message}` : ""}`
    )
  }

  const parsed = classificationSchema.parse(raw)

  // Defensive invariant: if the model says no reply is required, the draft must
  // be null. The system prompt forbids the violation, but cheap to enforce
  // server-side rather than discover via a confusing UI later.
  if (!parsed.reply_required && parsed.draft_reply !== null) {
    parsed.draft_reply = null
  }
  // And the inverse: a missing no_reply_reason when no reply is required is a
  // contract violation we'd rather coerce than surface as a Postgres CHECK
  // failure. Default to "fyi" — the broadest bucket.
  if (!parsed.reply_required && parsed.no_reply_reason === null) {
    parsed.no_reply_reason = "fyi"
  }
  if (parsed.reply_required && parsed.no_reply_reason !== null) {
    parsed.no_reply_reason = null
  }

  return parsed
}

function formatEmail(input: ClassifierInput): string {
  const body = input.body ?? input.snippet ?? "(no body)"
  const trimmed =
    body.length > MAX_BODY_CHARS_FOR_AI
      ? `${body.slice(0, MAX_BODY_CHARS_FOR_AI)}\n\n[…body truncated for length]`
      : body

  return [
    `Subject: ${input.subject ?? "(no subject)"}`,
    `From: ${input.sender ?? "(unknown sender)"}`,
    "",
    trimmed,
  ].join("\n")
}
