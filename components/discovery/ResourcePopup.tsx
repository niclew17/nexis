"use client";
import { useEffect } from "react";
import type { BubbleNode } from "@/hooks/useBubbleState";

interface ResourcePopupProps {
  bubble: BubbleNode;
  onClose: () => void;
}

export function ResourcePopup({ bubble, onClose }: ResourcePopupProps) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: "rgba(0, 0, 0, 0.65)",
          zIndex: 30,
        }}
      />

      {/* Card — centered in the canvas */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          backgroundColor: "#080808",
          border: "1px solid #2a5e49",
          padding: "32px",
          maxWidth: "480px",
          width: "calc(100% - 48px)",
          zIndex: 31,
          display: "flex",
          flexDirection: "column",
          gap: "16px",
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: "16px",
            right: "16px",
            background: "none",
            border: "none",
            color: "#666",
            fontSize: "1.25rem",
            cursor: "pointer",
            lineHeight: 1,
            padding: "4px 8px",
          }}
          aria-label="Close"
        >
          ×
        </button>

        <p
          style={{
            fontFamily: "ui-sans-serif, system-ui, -apple-system",
            fontSize: "1.5rem",
            fontWeight: 600,
            color: "white",
            margin: 0,
            paddingRight: "32px",
          }}
        >
          {bubble.title}
        </p>

        {bubble.description && (
          <p
            style={{
              fontFamily: "var(--font-instrument-serif)",
              fontSize: "1.125rem",
              color: "#aaaaaa",
              margin: 0,
              lineHeight: 1.65,
            }}
          >
            {bubble.description}
          </p>
        )}

        {bubble.topics.length > 0 && (
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {bubble.topics.map(topic => (
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

        {bubble.link && (
          <a
            href={bubble.link}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontFamily: "ui-sans-serif, system-ui, -apple-system",
              fontSize: "1rem",
              color: "#2a5e49",
              textDecoration: "underline",
            }}
          >
            Learn more →
          </a>
        )}
      </div>
    </>
  );
}
