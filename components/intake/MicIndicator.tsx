"use client";

export function MicIndicator({ isListening }: { isListening: boolean }) {
  if (!isListening) return null;
  return (
    <div
      style={{
        width: 12,
        height: 12,
        borderRadius: "50%",
        backgroundColor: "#2a5e49",
        animation: "mic-pulse 1.2s ease-out infinite",
      }}
    />
  );
}
