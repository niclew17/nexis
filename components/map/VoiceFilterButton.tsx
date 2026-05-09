"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useCallback, useRef } from "react";
import { useDeepgram, MicDeniedError } from "@/hooks/useDeepgram";
import { useMapStore } from "@/lib/map/store";
import { COLORS } from "@/lib/map/mapConfig";
import { MicVisual } from "@/components/voice/MicVisual";

interface VoiceFilterButtonProps {
  /** "floating" pins the control to the bottom-center of the viewport (mobile);
   *  "inline" lays the control out in the normal flow so a parent can position it
   *  inside a sidebar. */
  variant?: "floating" | "inline";
}

export function VoiceFilterButton({ variant = "floating" }: VoiceFilterButtonProps = {}) {
  const {
    isListening,
    voicePromptVisible,
    setIsListening,
    setVoicePromptVisible,
    setFilters,
  } = useMapStore();

  // Refs prevent stale closure on the transcript captured by useDeepgram's
  // onSilenceDetected callback (mirrors hooks/useVoiceIntake.ts ref pattern).
  const transcriptRef = useRef("");
  const stopListeningRef = useRef<() => void>(() => {});
  const resetTranscriptRef = useRef<() => void>(() => {});

  const handleSilence = useCallback(async () => {
    const t = transcriptRef.current.trim();
    stopListeningRef.current();
    setIsListening(false);
    setVoicePromptVisible(false);
    if (!t) return;

    try {
      const res = await fetch("/api/map/parse-filter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: t }),
      });
      const filters = (await res.json()) as {
        stage: string[];
        size: string[];
        section: string[];
        county: string[];
        hiring: boolean;
      };
      setFilters(filters);
    } catch (err) {
      console.error("[VoiceFilter] parse-filter failed:", err);
    } finally {
      resetTranscriptRef.current();
    }
  }, [setIsListening, setVoicePromptVisible, setFilters]);

  const {
    transcript,
    isConnected,
    startListening,
    stopListening,
    resetTranscript,
  } = useDeepgram(handleSilence);

  transcriptRef.current = transcript;
  stopListeningRef.current = stopListening;
  resetTranscriptRef.current = resetTranscript;

  const handleMicClick = async () => {
    if (isListening) {
      stopListening();
      setIsListening(false);
      setVoicePromptVisible(false);
      resetTranscript();
      return;
    }
    setVoicePromptVisible(true);
    setIsListening(true);
    try {
      await startListening();
    } catch (err) {
      if (err instanceof MicDeniedError) {
        setIsListening(false);
        setVoicePromptVisible(false);
      }
    }
  };

  const containerStyle: React.CSSProperties =
    variant === "floating"
      ? {
          position: "fixed",
          bottom: "28px",
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 50,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "12px",
        }
      : {
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "12px",
        };

  return (
    <div style={containerStyle}>
      <AnimatePresence>
        {voicePromptVisible && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            style={{
              backgroundColor: "rgba(0,0,0,0.88)",
              backdropFilter: "blur(12px)",
              border: `1px solid ${COLORS.borderAccent}`,
              padding: "10px 20px",
              borderRadius: "2px",
              fontFamily: "var(--font-instrument-serif)",
              fontStyle: "italic",
              fontSize: "0.9375rem",
              color: COLORS.text,
              whiteSpace: "nowrap",
            }}
          >
            {transcript || "What companies do you want to see?"}
          </motion.div>
        )}
      </AnimatePresence>

      <MicVisual
        interactive
        isListening={isConnected}
        onClick={handleMicClick}
        ariaLabel={isListening ? "Stop listening" : "Filter by voice"}
      />
    </div>
  );
}
