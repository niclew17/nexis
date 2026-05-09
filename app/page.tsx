"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useVoiceIntake } from "@/hooks/useVoiceIntake";
import { useBubbleState } from "@/hooks/useBubbleState";
import { VoiceIntake } from "@/components/intake/VoiceIntake";
import { BubbleField } from "@/components/discovery/BubbleField";
import { EmailPanel } from "@/components/results/EmailPanel";

function HomeContent() {
  const intake = useVoiceIntake();
  const { bubbles, activeCount, initBubbles, triggerElimination, onBubbleEliminated } = useBubbleState();

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Load all resources once on mount — seed both the bubble field and the intake filter pool.
  const initFilterPool = intake.initFilterPool;
  useEffect(() => {
    fetch("/api/discovery/start")
      .then(r => r.json())
      .then(data => {
        const resources = data.resources ?? [];
        initBubbles(resources);
        initFilterPool(resources.map((r: { id: string }) => r.id));
      });
  }, [initBubbles, initFilterPool]);

  // Eliminate bubbles when activeFilterIds narrows after each Q1-Q4 answer.
  const prevFilterIdsRef = useRef<string[]>([]);
  useEffect(() => {
    const current = intake.activeFilterIds;
    if (current.length === 0) return;
    const prev = prevFilterIdsRef.current;
    if (prev.length === 0) {
      prevFilterIdsRef.current = current;
      return;
    }
    const currentSet = new Set(current);
    const eliminated = prev.filter(id => !currentSet.has(id));
    prevFilterIdsRef.current = current;
    if (eliminated.length > 0) triggerElimination(eliminated);
  }, [intake.activeFilterIds, triggerElimination]);

  // When Q5 results arrive, eliminate everything except the top 5.
  const matchResultsRef = useRef(intake.matchResults);
  useEffect(() => {
    if (!intake.matchResults) return;
    if (matchResultsRef.current === intake.matchResults) return;
    matchResultsRef.current = intake.matchResults;

    const topIds = new Set(intake.matchResults.results.map(r => r.id));
    const toEliminate = intake.activeFilterIds.filter(id => !topIds.has(id));
    if (toEliminate.length > 0) triggerElimination(toEliminate);
  }, [intake.matchResults, intake.activeFilterIds, triggerElimination]);

  if (isMobile) {
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
        <VoiceIntake {...intake} />
      </main>
    );
  }

  return (
    <div
      style={{
        height: "100dvh",
        overflow: "hidden",
        display: "flex",
        flexDirection: "row",
        backgroundColor: "black",
        color: "white",
      }}
    >
      {/* Left — voice intake */}
      <div
        style={{
          position: "relative",
          width: "45%",
          minWidth: "360px",
          maxWidth: "560px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          borderRight: "1px solid #111",
          overflowY: "auto",
        }}
      >
        {/* Nexis logo — absolute, centered horizontally so it doesn't disturb vertical centering of intake content */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo.png"
          alt="Nexis"
          style={{
            position: "absolute",
            top: "32px",
            left: "50%",
            transform: "translateX(-50%)",
            height: "72px",
            width: "auto",
            opacity: 0.9,
            pointerEvents: "none",
            userSelect: "none",
          }}
        />

        {/* margin: auto top/bottom centers content when shorter than panel;
            collapses to 0 when content overflows, making top scrollable. Top padding
            (128px) clears the absolute-positioned logo so results content doesn't overlap. */}
        <div style={{ marginTop: "auto", marginBottom: "auto", width: "100%", padding: "128px 0 64px" }}>
          <VoiceIntake {...intake} />
        </div>
      </div>

      {/* Right — bubble canvas OR email panel */}
      <div style={{ flex: 1, height: "100%", position: "relative" }}>
        {intake.matchResults ? (
          <EmailPanel results={intake.matchResults.results} />
        ) : (
          <BubbleField
            bubbles={bubbles}
            activeCount={activeCount}
            onBubbleEliminated={onBubbleEliminated}
          />
        )}
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100dvh", backgroundColor: "black" }} />}>
      <HomeContent />
    </Suspense>
  );
}
