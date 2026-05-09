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
