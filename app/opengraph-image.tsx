import { ImageResponse } from "next/og"

export const runtime = "edge"
export const alt = "InboxIQ — Email triage on autopilot"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default async function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 80,
          backgroundColor: "#0a0a0a",
          color: "#ffffff",
          fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 56,
              height: 56,
              border: "2px solid #ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 28,
              fontWeight: 700,
            }}
          >
            IQ
          </div>
          <div style={{ fontSize: 28, fontWeight: 600, letterSpacing: -0.5 }}>
            InboxIQ
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div
            style={{
              fontSize: 84,
              fontWeight: 700,
              lineHeight: 1.05,
              letterSpacing: -2,
              maxWidth: 1000,
            }}
          >
            Email triage on autopilot.
          </div>
          <div
            style={{
              fontSize: 28,
              color: "#a1a1aa",
              lineHeight: 1.4,
              maxWidth: 900,
            }}
          >
            AI inbox assistant — categorize, score urgency, summarize, draft replies.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 20,
            color: "#71717a",
          }}
        >
          <span>10 free classifications per day</span>
          <span>$19/mo for unlimited</span>
        </div>
      </div>
    ),
    { ...size }
  )
}
