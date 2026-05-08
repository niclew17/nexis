"use client";

export function ConfirmedAnswer({
  answer,
}: {
  answer: string;
  questionIndex: number;
}) {
  if (!answer) return null;
  return (
    <p
      style={{
        fontFamily: "var(--font-instrument-serif)",
        fontSize: "1.125rem",
        color: "#2a5e49",
        textAlign: "center",
        margin: "8px 0",
        opacity: 1,
        transition: "opacity 300ms ease-out",
      }}
    >
      {answer}
    </p>
  );
}
