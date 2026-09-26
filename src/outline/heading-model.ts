import type { CachedMetadata } from "obsidian";

export interface Heading {
  text: string;
  level: number;
  line: number;
}

export function normalizeHeadings(cache: CachedMetadata | null): Heading[] {
  if (!cache || !cache.headings) return [];
  return cache.headings.map((h) => ({
    text: h.heading,
    level: h.level,
    line: h.position.start.line,
  }));
}

export interface TickGeometry {
  width: number;   // px
  opacity: number; // 0..1
}

const TICK_MAX_WIDTH = 16;
const TICK_MIN_WIDTH = 8;
const TICK_WIDTH_STEP = 2;
const TICK_MAX_OPACITY = 0.9;
const TICK_OPACITY_STEP = 0.12;
const TICK_MIN_OPACITY = 0.35;

export function tickGeometry(level: number): TickGeometry {
  const depth = Math.min(Math.max(level, 1), 6) - 1; // 0..5
  return {
    width: Math.max(TICK_MAX_WIDTH - depth * TICK_WIDTH_STEP, TICK_MIN_WIDTH),
    opacity: Math.max(TICK_MAX_OPACITY - depth * TICK_OPACITY_STEP, TICK_MIN_OPACITY),
  };
}
