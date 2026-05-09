"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useMapStore } from "@/lib/map/store";
import { COLORS } from "@/lib/map/mapConfig";

type FilterEntry =
  | { type: "stage" | "size" | "section" | "county"; value: string }
  | { type: "hiring"; value: "Hiring only" };

export function FilterChips() {
  const { filters, setFilters, clearFilters } = useMapStore();

  const allFilters: FilterEntry[] = [
    ...filters.stage.map((v) => ({ type: "stage" as const, value: v })),
    ...filters.size.map((v) => ({ type: "size" as const, value: v })),
    ...filters.section.map((v) => ({ type: "section" as const, value: v })),
    ...filters.county.map((v) => ({ type: "county" as const, value: v })),
    ...(filters.hiring
      ? [{ type: "hiring" as const, value: "Hiring only" as const }]
      : []),
  ];

  if (allFilters.length === 0) return null;

  const removeFilter = (entry: FilterEntry) => {
    if (entry.type === "hiring") {
      setFilters({ ...filters, hiring: false });
      return;
    }
    setFilters({
      ...filters,
      [entry.type]: filters[entry.type].filter((v) => v !== entry.value),
    });
  };

  return (
    <div
      style={{
        display: "flex",
        gap: "8px",
        flexWrap: "wrap",
        pointerEvents: "auto",
      }}
    >
      <AnimatePresence>
        {allFilters.map((entry) => (
          <motion.div
            key={`${entry.type}-${entry.value}`}
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "5px 12px",
              backgroundColor: "rgba(0,0,0,0.82)",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
              border: `1px solid ${COLORS.borderAccent}`,
              fontFamily: "ui-sans-serif, system-ui, -apple-system",
              fontSize: "0.75rem",
              color: COLORS.accent,
              letterSpacing: "0.04em",
            }}
          >
            {entry.value}
            <button
              type="button"
              onClick={() => removeFilter(entry)}
              style={{
                background: "none",
                border: "none",
                color: COLORS.textMuted,
                cursor: "pointer",
                padding: 0,
                lineHeight: 1,
                fontSize: "0.875rem",
              }}
              aria-label={`Remove ${entry.value} filter`}
            >
              ×
            </button>
          </motion.div>
        ))}
        {allFilters.length > 1 && (
          <motion.button
            key="clear-all"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={clearFilters}
            style={{
              background: "none",
              border: "none",
              color: COLORS.textMuted,
              fontFamily: "ui-sans-serif, system-ui, -apple-system",
              fontSize: "0.75rem",
              cursor: "pointer",
              textDecoration: "underline",
              padding: "5px 0",
            }}
          >
            clear all
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
