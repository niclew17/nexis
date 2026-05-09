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

// Counter keep-out zone — matches BubbleCounter's centered footprint.
const COUNTER_HALF_W = 70;
const COUNTER_HALF_H = 46;

// Compute a rectangular grid that fills width × height for n nodes, skipping cells
// whose center (expanded by bubble radius) would overlap the centered counter card.
// This keeps the grid uniform with a clean "hole" around the counter rather than
// having surrounding bubbles visibly displaced by simulation forces.
function computeGridTargets(
  n: number,
  width: number,
  height: number,
  radius: number
): Array<[number, number]> {
  if (n === 0) return [];

  const counterCx = width / 2;
  const counterCy = height / 2;
  // Expand the keep-out by bubble radius so a bubble at any valid cell can't overlap the counter
  const keepOutHalfW = COUNTER_HALF_W + radius;
  const keepOutHalfH = COUNTER_HALF_H + radius;

  // Generate slightly more cells than needed to compensate for the ones we'll skip
  const excludedFraction = Math.min(
    0.5,
    ((2 * keepOutHalfW) * (2 * keepOutHalfH)) / (width * height)
  );
  const targetCellCount = Math.ceil(n / Math.max(0.5, 1 - excludedFraction)) + 4;

  const aspectRatio = width / height;
  const cols = Math.max(1, Math.round(Math.sqrt(targetCellCount * aspectRatio)));
  const rows = Math.max(1, Math.ceil(targetCellCount / cols));
  const cellW = width / cols;
  const cellH = height / rows;

  const validCells: Array<[number, number]> = [];
  for (let row = 0; row < rows && validCells.length < n; row++) {
    for (let col = 0; col < cols && validCells.length < n; col++) {
      const cx = (col + 0.5) * cellW;
      const cy = (row + 0.5) * cellH;
      if (Math.abs(cx - counterCx) < keepOutHalfW && Math.abs(cy - counterCy) < keepOutHalfH) {
        continue;
      }
      validCells.push([cx, cy]);
    }
  }

  // Pad with canvas center if we still came up short (shouldn't happen at typical counts)
  while (validCells.length < n) {
    validCells.push([counterCx, counterCy]);
  }

  return validCells;
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

    // All bubbles share the same radius in a given simulation cycle (set by useBubbleState).
    const sharedRadius = activeBubbles[0]?.radius ?? 13;
    const gridTargets = computeGridTargets(activeBubbles.length, width, height, sharedRadius);

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
      // Safety net: nodes whose initial position lands inside the counter zone (e.g. survivors
      // whose previous-frame position was near canvas center) get pushed out. Grid targets are
      // already excluded from this zone, so steady-state bubbles never need this.
      const counterCx = width / 2;
      const counterCy = height / 2;
      const counterLeft = counterCx - COUNTER_HALF_W;
      const counterRight = counterCx + COUNTER_HALF_W;
      const counterTop = counterCy - COUNTER_HALF_H;
      const counterBottom = counterCy + COUNTER_HALF_H;

      simNodes.forEach(node => {
        // Clamp to canvas bounds
        node.x = Math.max(node.radius + 4, Math.min(width - node.radius - 4, node.x ?? 0));
        node.y = Math.max(node.radius + 4, Math.min(height - node.radius - 4, node.y ?? 0));

        // Push out of the centered counter keep-out region via the shortest escape direction
        const overlapsX = node.x + node.radius > counterLeft && node.x - node.radius < counterRight;
        const overlapsY = node.y + node.radius > counterTop && node.y - node.radius < counterBottom;
        if (overlapsX && overlapsY) {
          const pushLeftDist = (node.x + node.radius) - counterLeft;
          const pushRightDist = counterRight - (node.x - node.radius);
          const pushUpDist = (node.y + node.radius) - counterTop;
          const pushDownDist = counterBottom - (node.y - node.radius);
          const minPush = Math.min(pushLeftDist, pushRightDist, pushUpDist, pushDownDist);

          if (minPush === pushLeftDist) node.x = counterLeft - node.radius;
          else if (minPush === pushRightDist) node.x = counterRight + node.radius;
          else if (minPush === pushUpDist) node.y = counterTop - node.radius;
          else node.y = counterBottom + node.radius;
        }

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
