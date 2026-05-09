"use client";

import { motion, AnimatePresence } from "framer-motion";
import type { Startup } from "@/lib/map/types";
import { COLORS } from "@/lib/map/mapConfig";
import { FilterPanel } from "./FilterPanel";

interface FilterDrawerProps {
  startups: Startup[];
  isOpen: boolean;
  onClose: () => void;
}

// Mobile bottom-sheet wrapper around FilterPanel. Backdrop click and × button
// both close. Filter selections do NOT auto-close — users typically tap
// multiple chips per drawer session.
export function FilterDrawer({ startups, isOpen, onClose }: FilterDrawerProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            style={{
              position: "fixed",
              inset: 0,
              backgroundColor: "rgba(0,0,0,0.6)",
              zIndex: 90,
            }}
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            style={{
              position: "fixed",
              bottom: 0,
              left: 0,
              right: 0,
              maxHeight: "80dvh",
              overflowY: "auto",
              backgroundColor: "rgba(0,0,0,0.95)",
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
              borderTop: `1px solid ${COLORS.border}`,
              zIndex: 100,
              paddingTop: "16px",
              paddingBottom: "32px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "0 16px 16px",
                borderBottom: `1px solid ${COLORS.border}`,
                marginBottom: "16px",
              }}
            >
              <span
                style={{
                  fontFamily: "ui-sans-serif, system-ui, -apple-system",
                  fontSize: "0.875rem",
                  color: COLORS.text,
                }}
              >
                Filters
              </span>
              <button
                type="button"
                onClick={onClose}
                style={{
                  background: "none",
                  border: "none",
                  color: COLORS.textMuted,
                  fontSize: "1.25rem",
                  cursor: "pointer",
                  padding: "4px",
                  lineHeight: 1,
                }}
                aria-label="Close filters"
              >
                ×
              </button>
            </div>
            <FilterPanel startups={startups} />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
