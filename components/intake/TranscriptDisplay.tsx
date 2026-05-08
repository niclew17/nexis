"use client";

export function TranscriptDisplay({
  finalTranscript,
  interimTranscript,
}: {
  finalTranscript: string;
  interimTranscript: string;
}) {
  if (!finalTranscript && !interimTranscript) return null;
  return (
    <p
      style={{
        fontFamily: "var(--font-instrument-serif)",
        fontSize: "2rem",
        textAlign: "center",
        lineHeight: 1.7,
        margin: "24px 0",
        color: "white",
      }}
    >
      {finalTranscript}
      {interimTranscript && (
        <span style={{ color: "#666666", fontStyle: "italic" }}>
          {finalTranscript ? " " : ""}
          {interimTranscript}
        </span>
      )}
    </p>
  );
}
