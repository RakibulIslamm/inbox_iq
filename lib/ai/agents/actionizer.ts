import { z } from "zod"
import { DEFAULT_AI_MODEL } from "../env"
import { createOpenRouterClient } from "../openrouter"
import {
  ACTION_TYPES,
  NO_REPLY_REASONS,
  type ActionType,
  type NoReplyReason,
} from "./classifier"

/**
 * Lightweight backfill agent for emails that were classified before the
 * action-type columns existed. Takes the already-distilled summary and
 * action_items rather than re-reading the full body — about a third of the
 * tokens of a full classifier call.
 */

export const actionizationSchema = z.object({
  reply_required: z.boolean(),
  no_reply_reason: z.enum(NO_REPLY_REASONS).nullable(),
  action_type: z.enum(ACTION_TYPES),
})

export type Actionization = z.infer<typeof actionizationSchema>

export type ActionizerInput = {
  subject: string | null
  sender: string | null
  category: string | null
  summary: string | null
  action_items: string[]
  /** Whether the original classifier produced a draft (proxy for "reply was expected"). */
  has_draft: boolean
}

const SYSTEM_PROMPT = `You are InboxIQ's action categorizer.

You are given a summary, sender, and previously-extracted action items for one email. Call the \`categorize_actions\` tool exactly once with three fields:

- reply_required: true if a human is genuinely waiting on a written response. False for newsletters, automated alerts, no-reply senders (From contains "noreply"/"no-reply"/"do-not-reply"/"notifications"/"alerts@"), shipping confirmations, receipts, marketing, and pure-FYI mail.

- no_reply_reason: required when reply_required is false; null when true. Pick the most specific one of: "no_reply_sender", "automated", "fyi", "newsletter", "marketing", "receipt".

- action_type: the single primary action this email demands. Pick exactly one of:
  - reply — a human waiting on words (use unless a more specific verb fits)
  - review — read carefully and decide; no reply yet
  - pay — money out (invoices, renewals, payment failures, reimbursements)
  - sign — e-signature or formal acceptance (NDAs, offers, ToS)
  - schedule — calendar coordination (meeting requests, RSVPs, reschedules)
  - track — passive watch (shipment, delivery, flight, order status)
  - read — read-and-file FYI worth keeping
  - none — pure noise

  Consistency: if reply_required is true, action_type ∈ {reply, schedule, sign, pay, review}. If reply_required is false, action_type ∈ {review, pay, sign, schedule, track, read, none}; "reply" is forbidden.

Return only via the tool call.`

const TOOL_PARAMETERS = {
  type: "object",
  properties: {
    reply_required: {
      type: "boolean",
      description: "True iff a human is waiting on the user's words.",
    },
    no_reply_reason: {
      type: ["string", "null"],
      enum: [...NO_REPLY_REASONS, null],
      description:
        "Why no reply is needed. Required when reply_required is false; null otherwise.",
    },
    action_type: {
      type: "string",
      enum: [...ACTION_TYPES],
      description: "Primary action this email requires.",
    },
  },
  required: ["reply_required", "no_reply_reason", "action_type"],
  additionalProperties: false,
} as const

export async function actionizeEmail(
  input: ActionizerInput
): Promise<Actionization> {
  const client = createOpenRouterClient()

  const completion = await client.chat.completions.create({
    model: DEFAULT_AI_MODEL,
    temperature: 0.2,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: formatInput(input) },
    ],
    tools: [
      {
        type: "function",
        function: {
          name: "categorize_actions",
          description:
            "Submit reply_required, no_reply_reason, and action_type for the given email.",
          parameters: TOOL_PARAMETERS,
        },
      },
    ],
    tool_choice: {
      type: "function",
      function: { name: "categorize_actions" },
    },
  })

  const toolCall = completion.choices[0]?.message?.tool_calls?.[0]
  if (
    !toolCall ||
    toolCall.type !== "function" ||
    toolCall.function.name !== "categorize_actions"
  ) {
    throw new Error("Actionizer did not return a tool call.")
  }

  let raw: unknown
  try {
    raw = JSON.parse(toolCall.function.arguments)
  } catch (e) {
    throw new Error(
      `Actionizer returned invalid JSON: ${toolCall.function.arguments.slice(0, 200)}${e instanceof Error ? ` — ${e.message}` : ""}`
    )
  }

  const parsed = actionizationSchema.parse(raw)

  // Same defensive coercion as the classifier — keep the invariants tight so
  // downstream UI can branch on them confidently.
  if (!parsed.reply_required && parsed.no_reply_reason === null) {
    parsed.no_reply_reason = "fyi" as NoReplyReason
  }
  if (parsed.reply_required && parsed.no_reply_reason !== null) {
    parsed.no_reply_reason = null
  }
  if (parsed.reply_required && (parsed.action_type === "none" || parsed.action_type === "read")) {
    parsed.action_type = "reply" as ActionType
  }
  if (!parsed.reply_required && parsed.action_type === "reply") {
    parsed.action_type = "read" as ActionType
  }

  return parsed
}

function formatInput(input: ActionizerInput): string {
  const items =
    input.action_items.length > 0
      ? input.action_items.map((it) => `- ${it}`).join("\n")
      : "(none)"
  return [
    `Subject: ${input.subject ?? "(no subject)"}`,
    `From: ${input.sender ?? "(unknown sender)"}`,
    `Category: ${input.category ?? "(uncategorized)"}`,
    `Original draft was generated: ${input.has_draft ? "yes" : "no"}`,
    "",
    "Summary:",
    input.summary ?? "(none)",
    "",
    "Action items previously extracted:",
    items,
  ].join("\n")
}
