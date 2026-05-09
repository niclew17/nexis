"use client";
import { motion, AnimatePresence } from "framer-motion";

export function BubbleCounter({ count }: { count: number }) {
  return (
    <div
      style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        padding: "10px 18px",
        backgroundColor: "#0a0a0a",
        border: "1px solid #1e1e1e",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "2px",
        pointerEvents: "none",
        zIndex: 10,
      }}
    >
      <AnimatePresence mode="wait">
        <motion.span
          key={count}
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 6 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          style={{
            fontFamily: "ui-sans-serif, system-ui, -apple-system",
            fontSize: "2rem",
            color: "white",
            lineHeight: 1,
            display: "block",
          }}
        >
          {count}
        </motion.span>
      </AnimatePresence>
      <span
        style={{
          fontFamily: "ui-sans-serif, system-ui, -apple-system",
          fontSize: "0.625rem",
          color: "#555",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
        }}
      >
        resources
      </span>
    </div>
  );
}
