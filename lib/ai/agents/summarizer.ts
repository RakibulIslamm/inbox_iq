import { z } from "zod"
import { DEFAULT_AI_MODEL } from "../env"
import { createOpenRouterClient } from "../openrouter"

export const dailySummarySchema = z.object({
  summary: z.string().min(1).max(2000),
  action_items: z.array(z.string().min(1).max(280)).max(20),
})

export type DailySummary = z.infer<typeof dailySummarySchema>

export type DailyDigestEmail = {
  subject: string | null
  sender: string | null
  category: string | null
  urgency_score: number | null
  summary: string | null
  action_items: string[] | null
  draft_reply: string | null
}

const SYSTEM_PROMPT = `You are InboxIQ. Produce a tight daily inbox briefing for the user, based on the AI-classified emails they received today.

Rules:
- summary: 2–3 short paragraphs. Lead with what's urgent. Mention senders/topics, not raw counts.
- action_items: a deduplicated, concrete list of things the user should do today, drawn from the per-email action_items. Group similar items into one when sensible. Max 20.
- Skip newsletters and spam unless they contain a real action.
- Don't fabricate. If a category had no items, don't mention it.
- Plain prose. No headers, no bullets in the summary itself — bullets belong in action_items.

Return only via the \`daily_summary\` tool call.`

const TOOL_PARAMETERS = {
  type: "object",
  properties: {
    summary: {
      type: "string",
      description: "2–3 short paragraphs leading with what's urgent.",
    },
    action_items: {
      type: "array",
      items: { type: "string" },
      maxItems: 20,
      description: "Deduplicated concrete tasks for today.",
    },
  },
  required: ["summary", "action_items"],
  additionalProperties: false,
} as const

export async function summarizeDay(
  emails: DailyDigestEmail[]
): Promise<DailySummary> {
  const client = createOpenRouterClient()

  const completion = await client.chat.completions.create({
    model: DEFAULT_AI_MODEL,
    temperature: 0.3,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: formatDigest(emails) },
    ],
    tools: [
      {
        type: "function",
        function: {
          name: "daily_summary",
          description:
            "Submit the daily briefing: a 2–3 paragraph summary plus a deduplicated action_items list.",
          parameters: TOOL_PARAMETERS,
        },
      },
    ],
    tool_choice: { type: "function", function: { name: "daily_summary" } },
  })

  const toolCall = completion.choices[0]?.message?.tool_calls?.[0]
  if (!toolCall || toolCall.type !== "function" || toolCall.function.name !== "daily_summary") {
    throw new Error("Summarizer did not return a tool call.")
  }

  let raw: unknown
  try {
    raw = JSON.parse(toolCall.function.arguments)
  } catch (e) {
    throw new Error(
      `Summarizer returned invalid JSON${e instanceof Error ? `: ${e.message}` : ""}.`
    )
  }

  return dailySummarySchema.parse(raw)
}

function formatDigest(emails: DailyDigestEmail[]): string {
  if (emails.length === 0) {
    return "No classified emails today."
  }
  const lines: string[] = [
    `${emails.length} classified email${emails.length === 1 ? "" : "s"} today.`,
    "",
  ]
  emails.forEach((e, i) => {
    lines.push(`Email ${i + 1}:`)
    lines.push(`  From: ${e.sender ?? "(unknown)"}`)
    lines.push(`  Subject: ${e.subject ?? "(no subject)"}`)
    lines.push(`  Category: ${e.category ?? "(unprocessed)"}`)
    lines.push(`  Urgency: ${e.urgency_score ?? "?"}/10`)
    if (e.summary) lines.push(`  Summary: ${e.summary}`)
    if (e.action_items?.length) {
      lines.push(`  Actions:`)
      for (const a of e.action_items) lines.push(`    - ${a}`)
    }
    if (e.draft_reply) lines.push(`  Draft reply available: yes`)
    lines.push("")
  })
  return lines.join("\n")
}
