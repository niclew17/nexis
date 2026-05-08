"use client";

interface ResourceCardProps {
  title: string;
  matchReason: string;
  topics: string[];
  link: string;
}

export function ResourceCard({ title, matchReason, topics, link }: ResourceCardProps) {
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
          fontSize: "1.25rem",
          color: "white",
          fontWeight: 600,
          margin: 0,
        }}
      >
        {title}
      </p>
      <p
        style={{
          fontFamily: "var(--font-instrument-serif)",
          fontSize: "1rem",
          color: "#2a5e49",
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
                fontSize: "0.75rem",
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
      {link && (
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontFamily: "ui-sans-serif, system-ui, -apple-system",
            fontSize: "0.875rem",
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
