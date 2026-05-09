"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useMapStore } from "@/lib/map/store";
import { COLORS } from "@/lib/map/mapConfig";

type FilterType = "stage" | "size" | "section";

export function FilterChips() {
  const { filters, setFilters, clearFilters } = useMapStore();

  const allFilters: Array<{ type: FilterType; value: string }> = [
    ...filters.stage.map((v) => ({ type: "stage" as const, value: v })),
    ...filters.size.map((v) => ({ type: "size" as const, value: v })),
    ...filters.section.map((v) => ({ type: "section" as const, value: v })),
  ];

  if (allFilters.length === 0) return null;

  const removeFilter = (type: FilterType, value: string) => {
    setFilters({
      ...filters,
      [type]: filters[type].filter((v) => v !== value),
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
        {allFilters.map(({ type, value }) => (
          <motion.div
            key={`${type}-${value}`}
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
              border: `1px solid ${COLORS.borderAccent}`,
              fontFamily: "ui-sans-serif, system-ui, -apple-system",
              fontSize: "0.75rem",
              color: COLORS.accent,
              letterSpacing: "0.04em",
            }}
          >
            {value}
            <button
              onClick={() => removeFilter(type, value)}
              style={{
                background: "none",
                border: "none",
                color: COLORS.textMuted,
                cursor: "pointer",
                padding: 0,
                lineHeight: 1,
                fontSize: "0.875rem",
              }}
              aria-label={`Remove ${value} filter`}
            >
              ×
            </button>
          </motion.div>
        ))}
        {allFilters.length > 1 && (
          <motion.button
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
