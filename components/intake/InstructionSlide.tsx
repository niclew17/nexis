"use client";

export function InstructionSlide({ onBegin }: { onBegin: () => void }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "24px",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "12px",
          textAlign: "center",
        }}
      >
        <p
          style={{
            fontSize: "1.375rem",
            color: "white",
            fontFamily: "var(--font-instrument-serif)",
            fontStyle: "italic",
            margin: 0,
          }}
        >
          Speak your answers naturally.
        </p>
        <p
          style={{
            fontSize: "1.375rem",
            color: "white",
            fontFamily: "var(--font-instrument-serif)",
            fontStyle: "italic",
            margin: 0,
          }}
        >
          Silence moves you to the next question.
        </p>
        <p
          style={{
            fontSize: "1.375rem",
            color: "white",
            fontFamily: "var(--font-instrument-serif)",
            fontStyle: "italic",
            margin: 0,
          }}
        >
          Four questions. Under two minutes.
        </p>
      </div>
      <button
        onClick={onBegin}
        style={{
          marginTop: "16px",
          padding: "12px 40px",
          border: "1px solid white",
          background: "transparent",
          color: "white",
          fontSize: "1rem",
          fontFamily: "ui-sans-serif, system-ui, -apple-system",
          cursor: "pointer",
          letterSpacing: "0.05em",
        }}
      >
        Begin
      </button>
    </div>
  );
}
