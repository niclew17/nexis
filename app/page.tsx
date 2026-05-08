"use client";

import { VoiceIntake } from "@/components/intake/VoiceIntake";

export default function Home() {
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
      <VoiceIntake />
    </main>
  );
}
