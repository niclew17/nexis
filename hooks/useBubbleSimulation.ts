"use client";
import { useEffect, useRef } from "react";
import {
  forceSimulation,
  forceCollide,
  forceX,
  forceY,
  type SimulationNodeDatum,
} from "d3-force";
import type { BubbleNode } from "./useBubbleState";

export interface NodeSetters {
  setX: (v: number) => void;
  setY: (v: number) => void;
}

interface SimNode extends SimulationNodeDatum {
  id: string;
  radius: number;
  targetX: number;
  targetY: number;
}

// Compute a rectangular grid that fills width × height for n nodes.
// Returns [targetX, targetY] for each node index.
function computeGridTargets(n: number, width: number, height: number): Array<[number, number]> {
  if (n === 0) return [];
  const aspectRatio = width / height;
  const cols = Math.max(1, Math.round(Math.sqrt(n * aspectRatio)));
  const rows = Math.ceil(n / cols);
  const cellW = width / cols;
  const cellH = height / rows;
  return Array.from({ length: n }, (_, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    return [(col + 0.5) * cellW, (row + 0.5) * cellH];
  });
}

export function useBubbleSimulation(
  activeBubbles: BubbleNode[],
  width: number,
  height: number,
  nodeSettersRef: React.RefObject<Map<string, NodeSetters>>
): void {
  const simRef = useRef<ReturnType<typeof forceSimulation> | null>(null);
  const prevPositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());

  useEffect(() => {
    if (width === 0 || height === 0 || activeBubbles.length === 0) return;

    // Preserve positions of surviving nodes before restarting
    if (simRef.current) {
      (simRef.current.nodes() as SimNode[]).forEach(n => {
        if (n.x != null && n.y != null) {
          prevPositionsRef.current.set(n.id, { x: n.x, y: n.y });
        }
      });
      simRef.current.stop();
    }

    const gridTargets = computeGridTargets(activeBubbles.length, width, height);

    const simNodes: SimNode[] = activeBubbles.map((b, i) => {
      const [targetX, targetY] = gridTargets[i];
      const prev = prevPositionsRef.current.get(b.id);
      return {
        id: b.id,
        radius: b.radius,
        targetX,
        targetY,
        // Surviving nodes keep their position; new nodes start at grid target ± jitter
        x: prev?.x ?? targetX + (Math.random() - 0.5) * 20,
        y: prev?.y ?? targetY + (Math.random() - 0.5) * 20,
      };
    });

    const sim = forceSimulation<SimNode>(simNodes)
      // Pull each bubble toward its grid target cell
      .force("x", forceX<SimNode>(n => n.targetX).strength(0.12))
      .force("y", forceY<SimNode>(n => n.targetY).strength(0.12))
      // Prevent overlap — radius + 3px gap
      .force("collision", forceCollide<SimNode>(n => n.radius + 3).strength(0.85))
      .alphaDecay(0.015)
      .velocityDecay(0.4);

    sim.on("tick", () => {
      simNodes.forEach(node => {
        // Clamp to canvas bounds
        node.x = Math.max(node.radius + 4, Math.min(width - node.radius - 4, node.x ?? 0));
        node.y = Math.max(node.radius + 4, Math.min(height - node.radius - 4, node.y ?? 0));

        const setters = nodeSettersRef.current?.get(node.id);
        if (setters) {
          setters.setX(node.x);
          setters.setY(node.y);
        }
      });
    });

    simRef.current = sim as unknown as ReturnType<typeof forceSimulation>;

    return () => {
      sim.stop();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBubbles.length, width, height]);
}
