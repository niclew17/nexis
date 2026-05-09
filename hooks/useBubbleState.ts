"use client";
import { useState, useCallback } from "react";

export type BubbleStatus = "active" | "eliminating" | "eliminated";

export interface BubbleNode {
  id: string;
  title: string;
  description: string;
  topics: string[];
  link: string;
  status: BubbleStatus;
  radius: number;
  // color removed — all bubbles use #2a5e49 directly in ResourceBubble
}

interface UseBubbleStateReturn {
  bubbles: BubbleNode[];
  activeCount: number;
  initBubbles: (resources: Array<{
    id: string;
    title: string;
    topics: string[];
    description: string | null;
    link: string | null;
  }>) => void;
  triggerElimination: (ids: string[]) => void;
  onBubbleEliminated: (id: string) => void;
}

function computeRadius(activeCount: number, initialCount: number): number {
  const base = 13;
  const scaled = base * Math.sqrt(Math.max(initialCount, 1) / Math.max(activeCount, 1));
  return Math.min(80, Math.max(12, scaled));
}

export function useBubbleState(): UseBubbleStateReturn {
  const [bubbles, setBubbles] = useState<BubbleNode[]>([]);
  const [initialCount, setInitialCount] = useState(213);

  const activeCount = bubbles.filter(b => b.status === "active").length;

  const initBubbles = useCallback(
    (resources: Array<{
      id: string;
      title: string;
      topics: string[];
      description: string | null;
      link: string | null;
    }>) => {
      const count = resources.length;
      setInitialCount(count);
      const radius = computeRadius(count, count);
      setBubbles(
        resources.map(r => ({
          id: r.id,
          title: r.title,
          description: r.description ?? "",
          topics: r.topics ?? [],
          link: r.link ?? "",
          status: "active" as BubbleStatus,
          radius,
        }))
      );
    },
    []
  );

  const triggerElimination = useCallback((ids: string[]) => {
    const idSet = new Set(ids);
    setBubbles(prev =>
      prev.map(b => idSet.has(b.id) ? { ...b, status: "eliminating" as BubbleStatus } : b)
    );
  }, []);

  const onBubbleEliminated = useCallback((id: string) => {
    setBubbles(prev => {
      const updated = prev.map(b =>
        b.id === id ? { ...b, status: "eliminated" as BubbleStatus } : b
      );
      const newActive = updated.filter(b => b.status === "active").length;
      const newRadius = computeRadius(newActive, initialCount);
      return updated.map(b =>
        b.status === "active" ? { ...b, radius: newRadius } : b
      );
    });
  }, [initialCount]);

  return { bubbles, activeCount, initBubbles, triggerElimination, onBubbleEliminated };
}
