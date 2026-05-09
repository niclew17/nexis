"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useCallback, useRef } from "react";
import { useDeepgram, MicDeniedError } from "@/hooks/useDeepgram";
import { useMapStore } from "@/lib/map/store";
import { COLORS } from "@/lib/map/mapConfig";

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

      <AnimatePresence>
        {isConnected && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              display: "flex",
              gap: "4px",
              alignItems: "center",
              height: "20px",
            }}
          >
            {[0, 1, 2, 3, 4].map((i) => (
              <motion.div
                key={i}
                animate={{ scaleY: [0.4, 1.5, 0.4], opacity: [0.5, 1, 0.5] }}
                transition={{
                  duration: 0.7,
                  repeat: Infinity,
                  delay: i * 0.1,
                  ease: "easeInOut",
                }}
                style={{
                  width: 3,
                  height: 20,
                  backgroundColor: COLORS.accent,
                  borderRadius: 2,
                  transformOrigin: "center",
                }}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={handleMicClick}
        style={{
          width: 52,
          height: 52,
          borderRadius: "50%",
          border: `2px solid ${
            isListening ? COLORS.accentBright : COLORS.accent
          }`,
          backgroundColor: isListening
            ? COLORS.accentDim
            : "rgba(0,0,0,0.8)",
          backdropFilter: "blur(8px)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "all 0.2s ease-out",
          boxShadow: isListening
            ? `0 0 20px ${COLORS.accentDim}, 0 0 6px ${COLORS.accent}`
            : `0 0 8px ${COLORS.accentDim}`,
        }}
        aria-label={isListening ? "Stop listening" : "Filter by voice"}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke={isListening ? COLORS.accentBright : COLORS.accent}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="22" />
        </svg>
      </button>
    </div>
  );
}
