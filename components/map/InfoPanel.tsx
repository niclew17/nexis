"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import type { Startup } from "@/lib/map/types";
import { COLORS } from "@/lib/map/mapConfig";

interface InfoPanelProps {
  startup: Startup;
  onClose: () => void;
}

export function InfoPanel({ startup, onClose }: InfoPanelProps) {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const panel = isMobile
    ? {
        initial: { y: "100%", x: 0 },
        animate: { y: 0, x: 0 },
        exit: { y: "100%", x: 0 },
        style: { bottom: 0, left: 0, right: 0, maxHeight: "60dvh", width: "100%" },
      }
    : {
        initial: { x: "100%", y: 0 },
        animate: { x: 0, y: 0 },
        exit: { x: "100%", y: 0 },
        style: { top: 0, right: 0, bottom: 0, width: "380px" },
      };

  const badgeStyle = {
    padding: "3px 10px",
    fontSize: "0.6875rem",
    fontFamily: "ui-sans-serif, system-ui, -apple-system",
    letterSpacing: "0.06em",
    textTransform: "uppercase" as const,
    border: `1px solid ${COLORS.borderAccent}`,
    color: COLORS.accent,
    borderRadius: "2px",
  };

  return (
    <AnimatePresence>
      <motion.div
        key={startup.slug}
        initial={panel.initial}
        animate={panel.animate}
        exit={panel.exit}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        style={{
          position: "fixed",
          zIndex: 100,
          backgroundColor: "rgba(0, 0, 0, 0.92)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          borderLeft: isMobile ? "none" : `1px solid ${COLORS.border}`,
          borderTop: isMobile ? `1px solid ${COLORS.border}` : "none",
          display: "flex",
          flexDirection: "column",
          overflowY: "auto",
          ...panel.style,
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "24px 24px 0",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            {startup.logo_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={startup.logo_url}
                alt={startup.name}
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: "50%",
                  objectFit: "cover",
                  border: `1px solid ${COLORS.border}`,
                }}
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            )}
            <div>
              <h2
                style={{
                  fontFamily: "ui-sans-serif, system-ui, -apple-system",
                  fontSize: "1.25rem",
                  fontWeight: 600,
                  color: COLORS.text,
                  margin: 0,
                }}
              >
                {startup.name}
              </h2>
              {startup.address && (
                <p
                  style={{
                    fontFamily: "ui-sans-serif, system-ui, -apple-system",
                    fontSize: "0.8125rem",
                    color: COLORS.textMuted,
                    margin: "4px 0 0",
                  }}
                >
                  {startup.address}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: COLORS.textMuted,
              cursor: "pointer",
              fontSize: "1.25rem",
              padding: "4px",
              lineHeight: 1,
            }}
            aria-label="Close panel"
          >
            ×
          </button>
        </div>

        {/* Badges */}
        <div
          style={{
            padding: "16px 24px",
            display: "flex",
            gap: "8px",
            flexWrap: "wrap",
          }}
        >
          {startup.stage && <span style={badgeStyle}>{startup.stage}</span>}
          {startup.employees && (
            <span style={badgeStyle}>{startup.employees} emp</span>
          )}
          {startup.section && <span style={badgeStyle}>{startup.section}</span>}
        </div>

        {/* Description */}
        {startup.description && (
          <div style={{ padding: "0 24px 20px" }}>
            <p
              style={{
                fontFamily: "var(--font-instrument-serif)",
                fontSize: "1rem",
                color: "#cccccc",
                lineHeight: 1.7,
                margin: 0,
              }}
            >
              {startup.description}
            </p>
          </div>
        )}

        {/* Actions */}
        <div
          style={{
            padding: "20px 24px",
            borderTop: `1px solid ${COLORS.border}`,
            display: "flex",
            gap: "12px",
            marginTop: "auto",
          }}
        >
          {startup.website && (
            <a
              href={
                startup.website.startsWith("http")
                  ? startup.website
                  : `https://${startup.website}`
              }
              target="_blank"
              rel="noopener noreferrer"
              style={{
                flex: 1,
                padding: "10px 16px",
                border: `1px solid ${COLORS.accent}`,
                background: "transparent",
                color: COLORS.accent,
                textDecoration: "none",
                fontFamily: "ui-sans-serif, system-ui, -apple-system",
                fontSize: "0.875rem",
                textAlign: "center",
                letterSpacing: "0.05em",
                cursor: "pointer",
                transition: "background 0.2s ease-out, color 0.2s ease-out",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background =
                  COLORS.accent;
                (e.currentTarget as HTMLElement).style.color = "black";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = "transparent";
                (e.currentTarget as HTMLElement).style.color = COLORS.accent;
              }}
            >
              Visit website →
            </a>
          )}
          {startup.linkedin_url && (
            <a
              href={startup.linkedin_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                padding: "10px 16px",
                border: `1px solid ${COLORS.border}`,
                background: "transparent",
                color: COLORS.textMuted,
                textDecoration: "none",
                fontFamily: "ui-sans-serif, system-ui, -apple-system",
                fontSize: "0.875rem",
                letterSpacing: "0.05em",
              }}
            >
              LinkedIn
            </a>
          )}
        </div>

        {/* Back to Utah */}
        <div style={{ padding: "0 24px 24px" }}>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: COLORS.textMuted,
              fontFamily: "ui-sans-serif, system-ui, -apple-system",
              fontSize: "0.8125rem",
              cursor: "pointer",
              padding: 0,
              textDecoration: "underline",
            }}
          >
            ← Back to Utah
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
