"use client";

import { useEffect, useRef, useState } from "react";
import type { BehaviorSnapshot } from "@/lib/types";

const DEFAULT_BEHAVIOR: BehaviorSnapshot = {
  avgTypingDelay: 215,
  avgMouseVelocity: 1.18,
  sampleCount: 0,
};

const SAMPLE_WINDOW = 60;

function rollingAverage(values: number[], fallback: number): number {
  if (!values.length) {
    return fallback;
  }

  const total = values.reduce((acc, current) => acc + current, 0);
  return total / values.length;
}

function pushSample(values: number[], sample: number): void {
  values.push(sample);
  if (values.length > SAMPLE_WINDOW) {
    values.shift();
  }
}

export function useBehaviorTracker(): BehaviorSnapshot {
  const [snapshot, setSnapshot] = useState<BehaviorSnapshot>(DEFAULT_BEHAVIOR);
  const keyIntervals = useRef<number[]>([]);
  const mouseVelocities = useRef<number[]>([]);
  const lastKeyAt = useRef<number | null>(null);
  const lastMouse = useRef<{ x: number; y: number; t: number } | null>(null);

  useEffect(() => {
    const updateSnapshot = () => {
      const next: BehaviorSnapshot = {
        avgTypingDelay: rollingAverage(keyIntervals.current, DEFAULT_BEHAVIOR.avgTypingDelay),
        avgMouseVelocity: rollingAverage(
          mouseVelocities.current,
          DEFAULT_BEHAVIOR.avgMouseVelocity,
        ),
        sampleCount: keyIntervals.current.length + mouseVelocities.current.length,
      };

      setSnapshot(next);
    };

    const onKeydown = () => {
      const now = performance.now();
      if (lastKeyAt.current !== null) {
        const interval = now - lastKeyAt.current;
        if (interval > 20 && interval < 2000) {
          pushSample(keyIntervals.current, interval);
        }
      }
      lastKeyAt.current = now;

      updateSnapshot();
    };

    const onMousemove = (event: MouseEvent) => {
      const now = performance.now();
      const prev = lastMouse.current;

      if (prev) {
        const dt = now - prev.t;
        if (dt > 12) {
          const dx = event.clientX - prev.x;
          const dy = event.clientY - prev.y;
          const speed = Math.sqrt(dx * dx + dy * dy) / dt;
          if (speed > 0 && speed < 5) {
            pushSample(mouseVelocities.current, speed);
          }

          if (mouseVelocities.current.length % 6 === 0) {
            updateSnapshot();
          }
        }
      }

      lastMouse.current = { x: event.clientX, y: event.clientY, t: now };
    };

    document.addEventListener("keydown", onKeydown, { passive: true });
    document.addEventListener("mousemove", onMousemove, { passive: true });

    return () => {
      document.removeEventListener("keydown", onKeydown);
      document.removeEventListener("mousemove", onMousemove);
    };
  }, []);

  return snapshot;
}
