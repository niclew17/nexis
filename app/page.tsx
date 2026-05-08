"use client";

import { useAnonymousAuth } from "@/hooks/useAnonymousAuth";

export default function Home() {
  const { isReady } = useAnonymousAuth();

  if (!isReady) {
    return (
      <main
        style={{
          minHeight: "100dvh",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "black",
        }}
      />
    );
  }

  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "black",
        color: "white",
      }}
    >
      <div style={{ maxWidth: "680px", width: "100%", padding: "0 24px" }}>
        {/* Voice intake UI mounts here */}
        <p
          style={{
            fontFamily: "var(--font-instrument-serif)",
            fontSize: "1.25rem",
            textAlign: "center",
          }}
        >
          Nexis — ready
        </p>
      </div>
    </main>
  );
}
