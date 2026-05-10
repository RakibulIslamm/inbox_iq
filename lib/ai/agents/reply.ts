import { z } from "zod"
import { DEFAULT_AI_MODEL } from "../env"
import { createOpenRouterClient } from "../openrouter"

export const replySchema = z.object({
  draft_reply: z.string().min(1).max(4000),
})

export type ReplyInput = {
  subject: string | null
  sender: string | null
  body: string | null
  snippet: string | null
  /** Optional steering for re-generation. */
  tone?: "shorter" | "longer" | "more-formal" | "more-casual" | null
}

const MAX_BODY_CHARS_FOR_AI = 4000

const SYSTEM_PROMPT = `You are InboxIQ. Draft a reply to the user's email.

Rules:
- Match the sender's tone and language.
- Be concise: 2–6 sentences for typical replies.
- Plain text only — no markdown, no bullet points unless the email itself uses them.
- No subject line, no greeting placeholders like "[Your name]" — sign off with the user's first name only if you can confidently infer it from context, otherwise leave the sign-off bare.
- Do NOT invent commitments or facts. If you need information you don't have, ask for it.
- If the email genuinely doesn't expect a reply (newsletter, automated alert), still produce a brief acknowledgement — the user opted in by asking you to draft one.

Return only via the \`draft_reply\` tool call.`

const TOOL_PARAMETERS = {
  type: "object",
  properties: {
    draft_reply: {
      type: "string",
      description:
        "A ready-to-send plaintext reply. No markdown, no subject line.",
    },
  },
  required: ["draft_reply"],
  additionalProperties: false,
} as const

export async function regenerateReply(input: ReplyInput): Promise<string> {
  const client = createOpenRouterClient()

  const userContent = formatEmail(input)
  const messages: { role: "system" | "user"; content: string }[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: userContent },
  ]
  if (input.tone) {
    messages.push({
      role: "user",
      content: toneInstruction(input.tone),
    })
  }

  const completion = await client.chat.completions.create({
    model: DEFAULT_AI_MODEL,
    temperature: 0.5,
    messages,
    tools: [
      {
        type: "function",
        function: {
          name: "draft_reply",
          description:
            "Submit a single ready-to-send plaintext reply.",
          parameters: TOOL_PARAMETERS,
        },
      },
    ],
    tool_choice: { type: "function", function: { name: "draft_reply" } },
  })

  const toolCall = completion.choices[0]?.message?.tool_calls?.[0]
  if (!toolCall || toolCall.type !== "function" || toolCall.function.name !== "draft_reply") {
    throw new Error("Reply agent did not return a tool call.")
  }

  let raw: unknown
  try {
    raw = JSON.parse(toolCall.function.arguments)
  } catch (e) {
    throw new Error(
      `Reply agent returned invalid JSON${e instanceof Error ? `: ${e.message}` : ""}.`
    )
  }

  return replySchema.parse(raw).draft_reply
}

function toneInstruction(tone: NonNullable<ReplyInput["tone"]>): string {
  switch (tone) {
    case "shorter":
      return "Make the reply noticeably shorter — aim for 1–3 sentences total."
    case "longer":
      return "Expand the reply with more detail — but stay under 8 sentences."
    case "more-formal":
      return "Use a more formal, professional register."
    case "more-casual":
      return "Use a more casual, conversational register."
  }
}

function formatEmail(input: ReplyInput): string {
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
