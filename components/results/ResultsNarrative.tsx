"use client";

export function ResultsNarrative({ narrative }: { narrative: string }) {
  return (
    <p
      style={{
        fontFamily: "ui-sans-serif, system-ui, -apple-system",
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
