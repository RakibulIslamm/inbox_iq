import type { Classification, ClassifierInput } from "./agents/classifier"

/**
 * Cheap, deterministic pre-filter that catches highest-confidence
 * "definitely no AI value" emails BEFORE we burn an OpenRouter call.
 * Each match returns a synthesized Classification so process.ts can write
 * straight to the DB without ever calling the model.
 *
 * Intentionally conservative: false negatives (heuristic passes through to
 * AI) are cheap — one extra classification call. False positives (a real
 * client email mis-bucketed as automated) destroy product trust. So we
 * only fire on patterns that are nearly impossible to misread:
 *   - mailer-daemon / postmaster bounces
 *   - explicit "Auto-Reply" / "Out of Office" subject lines
 *   - the literal "do-not-reply" pattern in the From address (NOT "noreply@",
 *     which github / stripe / vercel etc. use for real, sometimes-urgent
 *     alerts that DO need AI judgment)
 *
 * Adding a 4th heuristic? Make sure it can't mis-fire on a real human's
 * email that happens to share a keyword. When in doubt, defer to the AI.
 */
export type PreTriageResult =
  | { handled: true; reason: PreTriageReason; classification: Classification }
  | { handled: false }

export type PreTriageReason = "bounce" | "auto_reply" | "do_not_reply"

export function preTriageEmail(input: ClassifierInput): PreTriageResult {
  const sender = (input.sender ?? "").toLowerCase()
  const subject = (input.subject ?? "").trim()

  if (/(?:^|<)(?:mailer-daemon|postmaster)@/i.test(sender)) {
    return {
      handled: true,
      reason: "bounce",
      classification: {
        category: "spam",
        urgency_score: 1,
        summary: subject || "Mail delivery notification.",
        action_items: [],
        draft_reply: null,
        reply_required: false,
        no_reply_reason: "automated",
        action_type: "none",
      },
    }
  }

  if (
    /^(?:re:\s*)?(?:auto[\s-]?reply|automatic reply|out of office|vacation reply|away from)/i.test(
      subject
    )
  ) {
    return {
      handled: true,
      reason: "auto_reply",
      classification: {
        category: "personal",
        urgency_score: 2,
        summary: subject || "Auto-reply from sender.",
        action_items: [],
        draft_reply: null,
        reply_required: false,
        no_reply_reason: "automated",
        action_type: "read",
      },
    }
  }

  // "do-not-reply" / "donotreply" — almost exclusively bulk marketing.
  // Deliberately NOT matching plain "noreply@": github / stripe / vercel
  // send security alerts, invoices, and deploy failures from those, and
  // the AI's job is to triage them properly.
  if (/(?:do[-_.]not[-_.]?reply|donotreply)@/i.test(sender)) {
    return {
      handled: true,
      reason: "do_not_reply",
      classification: {
        category: "newsletter",
        urgency_score: 2,
        summary: subject || "Automated message from a do-not-reply sender.",
        action_items: [],
        draft_reply: null,
        reply_required: false,
        no_reply_reason: "no_reply_sender",
        action_type: "read",
      },
    }
  }

  return { handled: false }
}
