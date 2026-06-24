"use client";

import { useEffect } from "react";

const SUPPORT_EMAIL = "seemakram15@gmail.com";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global-error]", error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "Arial, sans-serif", background: "#f7fbf8" }}>
        <main
          style={{
            minHeight: "100dvh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
            color: "#0d1b1e",
          }}
        >
          <section
            style={{
              width: "100%",
              maxWidth: 560,
              border: "1px solid #dce8e4",
              borderRadius: 24,
              background: "#ffffff",
              boxShadow: "0 16px 40px rgba(13, 27, 30, 0.08)",
              padding: 32,
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                margin: "0 auto",
                borderRadius: 999,
                background: "#feecef",
                color: "#dc3545",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 28,
                fontWeight: 700,
              }}
              aria-hidden="true"
            >
              !
            </div>
            <p style={{ margin: "20px 0 0", color: "#0a9b72", fontWeight: 800 }}>
              Stockli
            </p>
            <h1 style={{ margin: "14px 0 0", fontSize: 28, lineHeight: 1.2 }}>
              Something went wrong
            </h1>
            <p style={{ margin: "12px auto 0", maxWidth: 440, color: "#5f6f76", lineHeight: 1.6 }}>
              The app could not recover this screen. Please try again, and if it continues
              contact support so we can fix it quickly.
            </p>
            <div
              style={{
                marginTop: 22,
                border: "1px solid #dce8e4",
                borderRadius: 16,
                background: "#f3faf7",
                padding: 16,
                textAlign: "left",
              }}
            >
              <p style={{ margin: 0, fontWeight: 700 }}>Contact support</p>
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                style={{ display: "inline-block", marginTop: 8, color: "#0a9b72", fontWeight: 700 }}
              >
                {SUPPORT_EMAIL}
              </a>
              {error.digest ? (
                <p style={{ margin: "12px 0 0", color: "#5f6f76", fontSize: 12, wordBreak: "break-all" }}>
                  Error reference: {error.digest}
                </p>
              ) : null}
            </div>
            <div style={{ display: "grid", gap: 10, marginTop: 24 }}>
              <button
                type="button"
                onClick={reset}
                style={{
                  border: 0,
                  borderRadius: 12,
                  background: "#0a9b72",
                  color: "#ffffff",
                  cursor: "pointer",
                  fontWeight: 800,
                  padding: "12px 16px",
                }}
              >
                Try again
              </button>
              <button
                type="button"
                onClick={() => {
                  window.location.href = "/";
                }}
                style={{
                  border: "1px solid #dce8e4",
                  borderRadius: 12,
                  background: "#ffffff",
                  color: "#0d1b1e",
                  cursor: "pointer",
                  fontWeight: 800,
                  padding: "12px 16px",
                }}
              >
                Go back home
              </button>
            </div>
          </section>
        </main>
      </body>
    </html>
  );
}
