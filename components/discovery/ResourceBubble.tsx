"use client";
import React, { useEffect } from "react";
import { motion, useMotionValue } from "framer-motion";
import type { BubbleStatus } from "@/hooks/useBubbleState";
import type { NodeSetters } from "@/hooks/useBubbleSimulation";

interface ResourceBubbleProps {
  id: string;
  title: string;
  status: BubbleStatus;
  radius: number;
  initialDelay: number;
  isFinalMatch: boolean;
  onEliminated: (id: string) => void;
  onRegister: (id: string, setters: NodeSetters) => void;
  onUnregister: (id: string) => void;
  onBubbleHover: (title: string, bx: number, by: number, radius: number) => void;
  onBubbleLeave: () => void;
  onBubbleClick: (id: string) => void;
}

export const ResourceBubble = React.memo(function ResourceBubble({
  id,
  title,
  status,
  radius,
  initialDelay,
  isFinalMatch,
  onEliminated,
  onRegister,
  onUnregister,
  onBubbleHover,
  onBubbleLeave,
  onBubbleClick,
}: ResourceBubbleProps) {
  const mx = useMotionValue(0);
  const my = useMotionValue(0);

  useEffect(() => {
    onRegister(id, { setX: v => mx.set(v), setY: v => my.set(v) });
    return () => onUnregister(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const isEliminating = status === "eliminating";

  return (
    <motion.g
      style={{
        x: mx,
        y: my,
        transformBox: "fill-box",   // REQUIRED — SVG scale-origin fix
        transformOrigin: "center",  // REQUIRED — scale from element center
        cursor: isEliminating ? "default" : "pointer",
      }}
      initial={{ scale: 0, opacity: 0 }}
      animate={isEliminating ? { scale: 0, opacity: 0 } : { scale: 1, opacity: 1 }}
      transition={
        isEliminating
          ? { duration: 0.5, ease: "easeIn" }
          : { duration: 0.3, delay: initialDelay, ease: "easeOut" }
      }
      onAnimationComplete={() => {
        if (isEliminating) onEliminated(id);
      }}
      onMouseEnter={() => onBubbleHover(title, mx.get(), my.get(), radius)}
      onMouseLeave={onBubbleLeave}
      onClick={() => { if (!isEliminating) onBubbleClick(id); }}
    >
      <circle
        r={radius}
        fill="#2a5e49"
        fillOpacity={isFinalMatch ? 0.30 : 0.18}
        stroke="#2a5e49"
        strokeWidth={isFinalMatch ? 2.5 : 1.5}
        strokeOpacity={isFinalMatch ? 1.0 : 0.80}
      />
      {/* No text rendered inside bubble — title always shown via external tooltip */}
    </motion.g>
  );
});
