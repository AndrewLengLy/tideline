"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";

/** The scrubber position lives outside React, so playback at 16x re-renders only what subscribes to it. */
export class Playhead {
  pos = 0;
  private listeners = new Set<() => void>();

  set(pos: number) {
    if (pos === this.pos) return;
    this.pos = pos;
    for (const l of this.listeners) l();
  }

  subscribe = (l: () => void) => {
    this.listeners.add(l);
    return () => {
      this.listeners.delete(l);
    };
  };

  getIndex = () => Math.floor(this.pos);
  getPos = () => this.pos;
}

export function usePlayheadIndex(p: Playhead): number {
  return useSyncExternalStore(p.subscribe, p.getIndex, p.getIndex);
}

export type Speed = 1 | 4 | 16;

/** One 6-minute frame every 100 ms at 1x. A week takes 168 s at 1x and about 10 s at 16x. */
const FRAME_MS = 100;

export function usePlayback(p: Playhead, frameCount: number, playing: boolean, speed: Speed, onEnd: () => void) {
  const end = useRef(onEnd);
  useEffect(() => {
    end.current = onEnd;
  }, [onEnd]);

  useEffect(() => {
    if (!playing || frameCount < 2) return;
    let last = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const next = p.pos + ((now - last) / FRAME_MS) * speed;
      last = now;
      if (next >= frameCount - 1) {
        p.set(frameCount - 1);
        end.current();
        return;
      }
      p.set(next);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [p, frameCount, playing, speed]);
}

export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
