"use client";

export function ResultsNarrative({ narrative }: { narrative: string }) {
  return (
    <p
      style={{
        fontFamily: "var(--font-instrument-serif)",
        fontStyle: "italic",
        fontSize: "1.5rem",
        color: "white",
        textAlign: "center",
        lineHeight: 1.5,
        margin: "0 0 48px",
      }}
    >
      {narrative}
    </p>
  );
}
