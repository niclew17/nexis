"use client";

import { COLORS } from "@/lib/map/mapConfig";

interface RolesCardProps {
  jobs: Array<{ title: string; url: string }>;
}

// Elevated bordered card listing open roles. Renders nothing for empty arrays
// so the parent doesn't need to gate at the call site.
export function RolesCard({ jobs }: RolesCardProps) {
  if (jobs.length === 0) return null;

  return (
    <div
      style={{
        border: `1px solid ${COLORS.borderAccent}`,
        padding: "16px",
        borderRadius: 4,
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        backgroundColor: "rgba(42, 94, 73, 0.04)",
      }}
    >
      <p
        style={{
          fontFamily: "ui-sans-serif, system-ui, -apple-system",
          fontSize: "0.6875rem",
          color: COLORS.textMuted,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          margin: 0,
        }}
      >
        Open roles
      </p>
      <ul
        style={{
          listStyle: "none",
          padding: 0,
          margin: 0,
          display: "flex",
          flexDirection: "column",
          gap: 0,
        }}
      >
        {jobs.map((j, i) => (
          <li
            key={`${j.url}-${i}`}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
              padding: "10px 0",
              borderTop: i === 0 ? "none" : `1px solid ${COLORS.border}`,
            }}
          >
            <span
              style={{
                fontFamily: "ui-sans-serif, system-ui, -apple-system",
                fontSize: "0.9375rem",
                color: COLORS.text,
              }}
            >
              {j.title}
            </span>
            <a
              href={j.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontFamily: "ui-sans-serif, system-ui, -apple-system",
                fontSize: "0.8125rem",
                color: COLORS.accent,
                textDecoration: "none",
                whiteSpace: "nowrap",
              }}
            >
              apply →
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
