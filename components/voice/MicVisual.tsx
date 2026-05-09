"use client";

import { motion, AnimatePresence } from "framer-motion";
import { COLORS } from "@/lib/map/mapConfig";

interface MicVisualProps {
  isListening: boolean;
  /** When true, renders a button with an onClick handler. When false, renders
   *  a non-interactive div — used by the intake flow where listening starts
   *  automatically per question. */
  interactive?: boolean;
  onClick?: () => void;
  ariaLabel?: string;
}

export function MicVisual({
  isListening,
  interactive = true,
  onClick,
  ariaLabel,
}: MicVisualProps) {
  const containerStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "12px",
  };

  const buttonStyle: React.CSSProperties = {
    width: 52,
    height: 52,
    borderRadius: "50%",
    border: `2px solid ${isListening ? COLORS.accentBright : COLORS.accent}`,
    backgroundColor: isListening ? COLORS.accentDim : "rgba(0,0,0,0.8)",
    backdropFilter: "blur(8px)",
    cursor: interactive ? "pointer" : "default",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "all 0.2s ease-out",
    boxShadow: isListening
      ? `0 0 20px ${COLORS.accentDim}, 0 0 6px ${COLORS.accent}`
      : `0 0 8px ${COLORS.accentDim}`,
    padding: 0,
  };

  const icon = (
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
  );

  return (
    <div style={containerStyle}>
      <AnimatePresence>
        {isListening && (
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

      {interactive ? (
        <button
          type="button"
          onClick={onClick}
          aria-label={ariaLabel}
          style={buttonStyle}
        >
          {icon}
        </button>
      ) : (
        <div style={buttonStyle} aria-label={ariaLabel}>
          {icon}
        </div>
      )}
    </div>
  );
}
