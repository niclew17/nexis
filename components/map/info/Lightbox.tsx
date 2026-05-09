"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { COLORS } from "@/lib/map/mapConfig";
import { PHOTO_BUCKET } from "@/lib/startups/photoConfig";

interface LightboxProps {
  photos: string[];
  startIndex: number;
  onClose: () => void;
}

export function Lightbox({ photos, startIndex, onClose }: LightboxProps) {
  const supabase = useMemo(() => createClient(), []);
  const urls = useMemo(
    () =>
      photos.map(
        (p) => supabase.storage.from(PHOTO_BUCKET).getPublicUrl(p).data.publicUrl
      ),
    [photos, supabase]
  );

  const [index, setIndex] = useState(() =>
    Math.max(0, Math.min(startIndex, photos.length - 1))
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") setIndex((i) => (i + 1) % photos.length);
      else if (e.key === "ArrowLeft")
        setIndex((i) => (i - 1 + photos.length) % photos.length);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [photos.length, onClose]);

  if (photos.length === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 200,
          backgroundColor: "rgba(0,0,0,0.96)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "zoom-out",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={urls[index]}
          alt={`Photo ${index + 1} of ${photos.length}`}
          onClick={(e) => e.stopPropagation()}
          style={{
            maxWidth: "92vw",
            maxHeight: "86vh",
            objectFit: "contain",
            cursor: "default",
          }}
        />

        {/* Close */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          style={overlayBtn({ top: 20, right: 20 })}
          aria-label="Close gallery"
        >
          ×
        </button>

        {photos.length > 1 && (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIndex((i) => (i - 1 + photos.length) % photos.length);
              }}
              style={overlayBtn({ top: "50%", left: 20 })}
              aria-label="Previous photo"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIndex((i) => (i + 1) % photos.length);
              }}
              style={overlayBtn({ top: "50%", right: 20 })}
              aria-label="Next photo"
            >
              ›
            </button>
            <div
              style={{
                position: "absolute",
                bottom: 24,
                left: "50%",
                transform: "translateX(-50%)",
                fontFamily: "ui-sans-serif, system-ui, -apple-system",
                fontSize: "0.75rem",
                color: COLORS.textMuted,
                letterSpacing: "0.06em",
              }}
            >
              {index + 1} / {photos.length}
            </div>
          </>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

function overlayBtn(pos: {
  top?: number | string;
  bottom?: number | string;
  left?: number | string;
  right?: number | string;
}): React.CSSProperties {
  return {
    position: "absolute",
    width: 44,
    height: 44,
    borderRadius: "50%",
    border: `1px solid ${COLORS.border}`,
    background: "rgba(0,0,0,0.6)",
    color: COLORS.text,
    fontSize: "1.5rem",
    lineHeight: 1,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transform: pos.top === "50%" ? "translateY(-50%)" : undefined,
    ...pos,
  };
}
