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

export const classificationSchema = z.object({
  category: z.enum(EMAIL_CATEGORIES),
  urgency_score: z.number().int().min(1).max(10),
  summary: z.string().min(1).max(500),
  action_items: z.array(z.string().min(1).max(280)).max(3),
  // null when no reply is expected (newsletters, FYI, marketing).
  draft_reply: z.string().nullable(),
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
  },
  required: ["category", "urgency_score", "summary", "action_items", "draft_reply"],
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

  return classificationSchema.parse(raw)
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
