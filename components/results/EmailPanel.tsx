"use client";
import { useState } from "react";
import { copyDraftEmail } from "@/lib/results/sendEmail";

interface MatchResult {
  id: string;
  title: string;
  matchReason: string;
  topics: string[];
  link: string;
  resourceEmail: string | null;
  draftEmail: string;
  emailSubject: string;
}

interface EmailPanelProps {
  results: MatchResult[];
}

export function EmailPanel({ results }: EmailPanelProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [copied, setCopied] = useState(false);

  if (!results.length) return null;
  const active = results[activeIndex];

  const handleCopy = async (result: MatchResult) => {
    if (!result.draftEmail) return;
    await copyDraftEmail(result.draftEmail);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleVisitWebsite = (result: MatchResult) => {
    if (result.link) {
      window.open(result.link, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "black",
        borderLeft: "1px solid #111",
      }}
    >
      {/* Tab row */}
      <div style={{ display: "flex", borderBottom: "1px solid #111" }}>
        {results.map((r, i) => (
          <button
            key={r.id}
            onClick={() => setActiveIndex(i)}
            style={{
              flex: 1,
              padding: "16px 12px",
              background: "none",
              border: "none",
              borderBottom: i === activeIndex ? "2px solid #2a5e49" : "2px solid transparent",
              color: i === activeIndex ? "white" : "#555",
              fontFamily: "ui-sans-serif, system-ui, -apple-system",
              fontSize: "0.9375rem",
              cursor: "pointer",
              textAlign: "center",
              letterSpacing: "0.03em",
              transition: "color 0.2s ease-out",
            }}
          >
            {r.title.length > 28 ? r.title.slice(0, 28) + "…" : r.title}
          </button>
        ))}
      </div>

      {/* Email preview area */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "32px 28px",
          display: "flex",
          flexDirection: "column",
          gap: "20px",
        }}
      >
        {/* Subject line */}
        <div>
          <p
            style={{
              fontFamily: "ui-sans-serif, system-ui, -apple-system",
              fontSize: "0.8125rem",
              color: "#555",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              margin: "0 0 6px",
            }}
          >
            Subject
          </p>
          <p
            style={{
              fontFamily: "ui-sans-serif, system-ui, -apple-system",
              fontSize: "1.125rem",
              color: "white",
              margin: 0,
              fontWeight: 500,
            }}
          >
            {active.emailSubject}
          </p>
        </div>

        {/* To line */}
        {active.resourceEmail && (
          <div>
            <p
              style={{
                fontFamily: "ui-sans-serif, system-ui, -apple-system",
                fontSize: "0.8125rem",
                color: "#555",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                margin: "0 0 6px",
              }}
            >
              To
            </p>
            <p
              style={{
                fontFamily: "ui-sans-serif, system-ui, -apple-system",
                fontSize: "1rem",
                color: "#888",
                margin: 0,
              }}
            >
              {active.resourceEmail}
            </p>
          </div>
        )}

        {/* Divider */}
        <div style={{ height: "1px", backgroundColor: "#1a1a1a" }} />

        {/* Email body */}
        <p
          style={{
            fontFamily: "ui-sans-serif, system-ui, -apple-system",
            fontSize: "1.125rem",
            color: "#e5e5e5",
            lineHeight: 1.75,
            margin: 0,
            whiteSpace: "pre-wrap",
          }}
        >
          {active.draftEmail}
        </p>
      </div>

      {/* Action button — Send email when address is on file, else Visit website */}
      <div
        style={{
          padding: "20px 28px",
          borderTop: "1px solid #111",
          display: "flex",
          gap: "12px",
          alignItems: "center",
        }}
      >
        <button
          onClick={() =>
            active.resourceEmail ? handleCopy(active) : handleVisitWebsite(active)
          }
          disabled={!active.resourceEmail && !active.link}
          style={{
            flex: 1,
            padding: "12px 24px",
            border: "1px solid #2a5e49",
            background: "transparent",
            color: "#2a5e49",
            fontFamily: "ui-sans-serif, system-ui, -apple-system",
            fontSize: "1rem",
            cursor: !active.resourceEmail && !active.link ? "not-allowed" : "pointer",
            letterSpacing: "0.05em",
            transition: "background 0.2s ease-out, color 0.2s ease-out",
            opacity: !active.resourceEmail && !active.link ? 0.4 : 1,
          }}
          onMouseEnter={(e) => {
            if (!active.resourceEmail && !active.link) return;
            (e.currentTarget as HTMLElement).style.background = "#2a5e49";
            (e.currentTarget as HTMLElement).style.color = "black";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = "transparent";
            (e.currentTarget as HTMLElement).style.color = "#2a5e49";
          }}
        >
          {active.resourceEmail
            ? copied
              ? "Copied ✓"
              : "Copy email"
            : "Visit website →"}
        </button>
      </div>
    </div>
  );
}
