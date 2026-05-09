"use client";

import { useState } from "react";
import { copyDraftEmail } from "@/lib/results/sendEmail";

interface ResourceCardProps {
  title: string;
  matchReason: string;
  topics: string[];
  link: string;
  resourceEmail?: string | null;
  draftEmail?: string;
}

export function ResourceCard({
  title,
  matchReason,
  topics,
  link,
  resourceEmail,
  draftEmail,
}: ResourceCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!resourceEmail || !draftEmail) return;
    await copyDraftEmail(draftEmail);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      style={{
        border: "1px solid #222",
        padding: "24px",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        width: "100%",
        boxSizing: "border-box",
      }}
    >
      <p
        style={{
          fontFamily: "ui-sans-serif, system-ui, -apple-system",
          fontSize: "1.5rem",
          color: "white",
          fontWeight: 600,
          margin: 0,
        }}
      >
        {title}
      </p>
      <p
        style={{
          fontFamily: "ui-sans-serif, system-ui, -apple-system",
          fontSize: "1.125rem",
          color: "#e5e5e5",
          margin: 0,
          lineHeight: 1.5,
        }}
      >
        {matchReason}
      </p>
      {topics.length > 0 && (
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {topics.map((topic) => (
            <span
              key={topic}
              style={{
                fontFamily: "ui-sans-serif, system-ui, -apple-system",
                fontSize: "0.875rem",
                color: "#888",
                border: "1px solid #333",
                padding: "2px 8px",
                borderRadius: "99px",
              }}
            >
              {topic}
            </span>
          ))}
        </div>
      )}
      {resourceEmail && draftEmail && (
        <button
          onClick={handleCopy}
          style={{
            alignSelf: "flex-start",
            padding: "8px 16px",
            border: "1px solid #2a5e49",
            background: "transparent",
            color: "#2a5e49",
            fontFamily: "ui-sans-serif, system-ui, -apple-system",
            fontSize: "0.875rem",
            cursor: "pointer",
            letterSpacing: "0.03em",
            marginTop: "4px",
          }}
        >
          {copied ? "Copied ✓" : "Copy email"}
        </button>
      )}
      {link && (
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontFamily: "ui-sans-serif, system-ui, -apple-system",
            fontSize: "1rem",
            color: "white",
            textDecoration: "underline",
            marginTop: "4px",
          }}
        >
          Learn more →
        </a>
      )}
    </div>
  );
}
