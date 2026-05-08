"use client";

export function QuestionDisplay({ question }: { question: string }) {
  return (
    <p
      style={{
        fontFamily: "ui-sans-serif, system-ui, -apple-system",
        fontSize: "1.375rem",
        color: "white",
        textAlign: "center",
        lineHeight: 1.6,
        margin: "0 0 32px",
        transition: "opacity 200ms ease-out",
      }}
    >
      {question}
    </p>
  );
}
