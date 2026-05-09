"use client";
import { useRef, useEffect, useState, useCallback } from "react";
import { AnimatePresence } from "framer-motion";
import { useBubbleSimulation, type NodeSetters } from "@/hooks/useBubbleSimulation";
import { ResourceBubble } from "./ResourceBubble";
import { BubbleCounter } from "./BubbleCounter";
import { ResourcePopup } from "./ResourcePopup";
import type { BubbleNode } from "@/hooks/useBubbleState";

interface BubbleFieldProps {
  bubbles: BubbleNode[];
  activeCount: number;
  onBubbleEliminated: (id: string) => void;
}

export function BubbleField({ bubbles, activeCount, onBubbleEliminated }: BubbleFieldProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

  // Tooltip: store raw bubble center + radius; positioning computed at render time
  // so we can clamp to canvas bounds and flip when near top edge.
  const [tooltip, setTooltip] = useState<{
    title: string;
    bx: number;
    by: number;
    radius: number;
  } | null>(null);

  // Selected bubble for popup
  const [selectedBubble, setSelectedBubble] = useState<BubbleNode | null>(null);

  useEffect(() => {
    const measure = () => {
      if (containerRef.current) {
        setCanvasSize({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const nodeSettersRef = useRef<Map<string, NodeSetters>>(new Map());

  const handleRegister = useCallback((id: string, setters: NodeSetters) => {
    nodeSettersRef.current.set(id, setters);
  }, []);

  const handleUnregister = useCallback((id: string) => {
    nodeSettersRef.current.delete(id);
  }, []);

  // Hover: store raw bubble center (bx, by) + radius; final placement computed at render time.
  const handleBubbleHover = useCallback((title: string, bx: number, by: number, radius: number) => {
    setTooltip({ title, bx, by, radius });
  }, []);

  const handleBubbleLeave = useCallback(() => {
    setTooltip(null);
  }, []);

  // Click: bubblesRef keeps handleBubbleClick stable across bubble state changes
  const bubblesRef = useRef(bubbles);
  bubblesRef.current = bubbles;

  const handleBubbleClick = useCallback((id: string) => {
    const bubble = bubblesRef.current.find(b => b.id === id);
    if (bubble && bubble.status === "active") {
      setTooltip(null);
      setSelectedBubble(bubble);
    }
  }, []);

  const handleClosePopup = useCallback(() => {
    setSelectedBubble(null);
  }, []);

  const activeBubbles = bubbles.filter(b => b.status === "active");
  useBubbleSimulation(activeBubbles, canvasSize.width, canvasSize.height, nodeSettersRef);

  const isFinalPhase = activeCount <= 3;
  const visibleBubbles = bubbles.filter(b => b.status !== "eliminated");

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        backgroundColor: "black",
        overflow: "hidden",
      }}
    >
      <BubbleCounter count={activeCount} />

      {/* Tooltip — smart positioning: clamps X to canvas bounds; flips below when near top edge */}
      {tooltip && !selectedBubble && (() => {
        const HALF_W = 144; // half of maxWidth (288px) — used for X clamping margin
        const FLIP_THRESHOLD = 48; // px from top edge below which we flip the tooltip below the bubble
        const showBelow = (tooltip.by - tooltip.radius - 12) < FLIP_THRESHOLD;
        const clampedX = Math.max(
          HALF_W + 4,
          Math.min(canvasSize.width > 0 ? canvasSize.width - HALF_W - 4 : HALF_W + 4, tooltip.bx)
        );
        const displayY = showBelow
          ? tooltip.by + tooltip.radius + 12
          : tooltip.by - tooltip.radius - 12;
        const displayTransform = showBelow ? "translate(-50%, 0)" : "translate(-50%, -100%)";

        return (
          <div
            style={{
              position: "absolute",
              left: clampedX,
              top: displayY,
              transform: displayTransform,
              pointerEvents: "none",
              backgroundColor: "#0a0a0a",
              border: "1px solid #333",
              borderRadius: "4px",
              padding: "5px 10px",
              color: "white",
              fontSize: "0.75rem",
              fontFamily: "ui-sans-serif, system-ui, -apple-system",
              whiteSpace: "nowrap",
              zIndex: 20,
              maxWidth: "288px",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {tooltip.title}
          </div>
        );
      })()}

      <svg
        width={canvasSize.width}
        height={canvasSize.height}
        style={{ display: "block", overflow: "visible" }}
      >
        <AnimatePresence>
          {visibleBubbles.map((bubble, index) => (
            <ResourceBubble
              key={bubble.id}
              id={bubble.id}
              title={bubble.title}
              status={bubble.status}
              radius={bubble.radius}
              initialDelay={index * 0.007}
              isFinalMatch={isFinalPhase && bubble.status === "active"}
              onEliminated={onBubbleEliminated}
              onRegister={handleRegister}
              onUnregister={handleUnregister}
              onBubbleHover={handleBubbleHover}
              onBubbleLeave={handleBubbleLeave}
              onBubbleClick={handleBubbleClick}
            />
          ))}
        </AnimatePresence>
      </svg>

      {/* Resource popup — contained within BubbleField so it doesn't bleed into the left panel */}
      {selectedBubble && (
        <ResourcePopup bubble={selectedBubble} onClose={handleClosePopup} />
      )}
    </div>
  );
}
