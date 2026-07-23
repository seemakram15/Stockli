import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Stockli — Track every market portfolio";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          display: "flex",
          position: "relative",
          background: "#06120f",
          fontFamily: "system-ui, -apple-system, sans-serif",
          overflow: "hidden",
        }}
      >
        {/* Top-left glow blob */}
        <div
          style={{
            position: "absolute",
            top: -160,
            left: -120,
            width: 640,
            height: 640,
            borderRadius: "50%",
            background: "rgba(34,197,94,0.16)",
            display: "flex",
          }}
        />
        {/* Bottom-right glow blob */}
        <div
          style={{
            position: "absolute",
            bottom: -100,
            right: -80,
            width: 500,
            height: 500,
            borderRadius: "50%",
            background: "rgba(34,197,94,0.09)",
            display: "flex",
          }}
        />

        {/* Decorative chart line */}
        <svg
          style={{ position: "absolute", bottom: 48, right: 48 }}
          width="400"
          height="160"
          viewBox="0 0 400 160"
        >
          <polyline
            points="0,140 45,112 90,126 140,72 185,84 240,38 285,55 330,22 400,36"
            fill="none"
            stroke="rgba(34,197,94,0.20)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>

        {/* Content */}
        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            width: "100%",
            height: "100%",
            padding: "52px 64px",
          }}
        >
          {/* Top row */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 16,
                  background: "linear-gradient(135deg, #22c55e, #15803d)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span style={{ color: "#fff", fontSize: 32, fontWeight: 900, lineHeight: "1" }}>S</span>
              </div>
              <span style={{ color: "#f0fdf4", fontSize: 34, fontWeight: 700 }}>Stockli</span>
            </div>
            <div
              style={{
                border: "1px solid rgba(34,197,94,0.35)",
                borderRadius: 10,
                padding: "8px 20px",
                color: "#4ade80",
                fontSize: 17,
                fontWeight: 500,
                display: "flex",
              }}
            >
              mystockli.com
            </div>
          </div>

          {/* Headline */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                color: "#4ade80",
                fontSize: 16,
                fontWeight: 600,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
              }}
            >
              <div
                style={{
                  width: 28,
                  height: 2,
                  background: "#4ade80",
                  borderRadius: 2,
                  display: "flex",
                }}
              />
              All-market portfolio workspace
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              <span
                style={{
                  color: "#f0fdf4",
                  fontSize: 68,
                  fontWeight: 800,
                  lineHeight: "1.05",
                  letterSpacing: "-1.5px",
                }}
              >
                Track every
              </span>
              <span
                style={{
                  color: "#4ade80",
                  fontSize: 68,
                  fontWeight: 800,
                  lineHeight: "1.05",
                  letterSpacing: "-1.5px",
                }}
              >
                market move.
              </span>
            </div>

            <div style={{ color: "rgba(240,253,244,0.50)", fontSize: 22, marginTop: 4 }}>
              Live P&L · PSX, US & Global · Mutual Funds · Crypto · Alerts
            </div>
          </div>

          {/* Feature pills */}
          <div style={{ display: "flex", gap: 10 }}>
            {["Portfolio Tracker", "P/L Calendar", "Watchlist & Alerts", "Mutual Funds", "Fundamentals", "Crypto"].map(
              (label) => (
                <div
                  key={label}
                  style={{
                    border: "1px solid rgba(34,197,94,0.22)",
                    borderRadius: 100,
                    padding: "9px 20px",
                    color: "rgba(240,253,244,0.65)",
                    fontSize: 14,
                    fontWeight: 500,
                    display: "flex",
                  }}
                >
                  {label}
                </div>
              )
            )}
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
