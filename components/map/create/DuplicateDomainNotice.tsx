"use client";

import { COLORS } from "@/lib/map/mapConfig";

interface DuplicateDomainNoticeProps {
  domain: string;
  existingSlug: string;
  existingName: string;
  onRetry: () => void;
}

// Shown when /api/startups/create returns 409 with existingSlug. Primary CTA
// deep-links into the existing pin's claim flow on /map; secondary lets the
// user step back and try a different email/website.
export function DuplicateDomainNotice({
  domain,
  existingSlug,
  existingName,
  onRetry,
}: DuplicateDomainNoticeProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div>
        <h1
          style={{
            fontFamily: "ui-sans-serif, system-ui, -apple-system",
            fontSize: "2rem",
            color: COLORS.text,
            margin: 0,
            letterSpacing: "-0.01em",
            lineHeight: 1.15,
          }}
        >
          Already on the map
        </h1>
        <p
          style={{
            fontFamily: "ui-sans-serif, system-ui, -apple-system",
            fontSize: "0.9375rem",
            color: COLORS.textMuted,
            margin: "12px 0 0",
            lineHeight: 1.6,
          }}
        >
          A startup at <span style={{ color: COLORS.accent }}>{domain}</span>{" "}
          already exists: <strong style={{ color: COLORS.text }}>{existingName}</strong>.
          If that&apos;s your company, claim it instead.
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {/* Full nav into /map so the deep-link reader on MapClient picks up
            ?startup=<slug> and auto-opens the InfoPanel for that pin. */}
        <a
          href={`/map?startup=${encodeURIComponent(existingSlug)}`}
          style={{
            padding: "12px 16px",
            border: `1px solid ${COLORS.accent}`,
            background: "transparent",
            color: COLORS.accent,
            fontFamily: "ui-sans-serif, system-ui, -apple-system",
            fontSize: "0.875rem",
            letterSpacing: "0.05em",
            textAlign: "center",
            textDecoration: "none",
            transition: "background 0.2s ease-out, color 0.2s ease-out",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = COLORS.accent;
            (e.currentTarget as HTMLElement).style.color = "black";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = "transparent";
            (e.currentTarget as HTMLElement).style.color = COLORS.accent;
          }}
        >
          Claim {existingName} →
        </a>
        <button
          type="button"
          onClick={onRetry}
          style={{
            background: "none",
            border: "none",
            color: COLORS.textMuted,
            fontFamily: "ui-sans-serif, system-ui, -apple-system",
            fontSize: "0.8125rem",
            cursor: "pointer",
            textDecoration: "underline",
            padding: 0,
          }}
        >
          That&apos;s not us — start over with a different domain
        </button>
      </div>
    </div>
  );
}
