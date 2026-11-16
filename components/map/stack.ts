// The exploded view's slabs for one station: average high tide, the next king tide, and the
// slider. Pure, so the labels and the merge rule can be tested without a map.
import { fmtDayLabel, fmtMonthDay } from "@/lib/format";
import { futureTideEquivalent } from "@/lib/metrics/king-tides";
import { sliderTip } from "./slider-tip";

export type SlabKind = "average" | "king" | "slider" | "merged";

export interface Slab {
  /** NOAA step in feet above average high tide (MHHW). */
  ft: number;
  kind: SlabKind;
  label: string;
}

export interface StackKing {
  t: number;
  /** Feet above average low tide (MLLW). */
  height: number;
  /** Feet above average high tide (MHHW). */
  aboveMhhw: number;
}

/** Ground meters between neighboring slabs at full separation, before terrain exaggeration. */
export const SLAB_GAP_M = 900;

/** The NOAA step that matches the king tide, the same rounding the water slider uses for its marker. */
export function kingStep(king: StackKing | null): number | null {
  if (!king) return null;
  return Math.min(10, Math.round(futureTideEquivalent(king.aboveMhhw)));
}

export const AVERAGE_LABEL = "Average high tide. On a normal day the water stops here.";

export function kingLabel(king: StackKing): string {
  const eq = futureTideEquivalent(king.aboveMhhw);
  return `King tide, ${fmtDayLabel(king.t)}, ${king.height.toFixed(1)} ft. This is ${eq.toFixed(1)} ft above an average high tide.`;
}

export function mergedLabel(king: StackKing, sliderFt: number): string {
  return `Same water on two dates. The ${fmtMonthDay(king.t)} king tide reaches this line today. With ${sliderFt} ft of sea level rise, an ordinary high tide reaches it.`;
}

export function sliderLabel(sliderFt: number, king: StackKing | null): string {
  return `+${sliderFt} ft of sea level rise. ${sliderTip(sliderFt, king ? futureTideEquivalent(king.aboveMhhw) : null)}`;
}

/**
 * Slabs from the ground up. Steps that land on the same foot share one slab and one card. The
 * king tide and the slider on the same foot make the merged slab, the point of the whole view.
 */
export function buildStack(sliderFt: number, king: StackKing | null): Slab[] {
  const kStep = kingStep(king);
  const out: Slab[] = [{ ft: 0, kind: "average", label: AVERAGE_LABEL }];
  if (king && kStep !== null && kStep > 0) {
    out.push(kStep === sliderFt ? { ft: kStep, kind: "merged", label: mergedLabel(king, sliderFt) } : { ft: kStep, kind: "king", label: kingLabel(king) });
  } else if (king && kStep === 0) {
    out[0] = { ...out[0], label: `${AVERAGE_LABEL} The ${fmtMonthDay(king.t)} king tide stops near this line too.` };
  }
  if (sliderFt > 0 && sliderFt !== kStep) out.push({ ft: sliderFt, kind: "slider", label: sliderLabel(sliderFt, king) });
  return out.sort((a, b) => a.ft - b.ft);
}

/**
 * Height in meters for a water level on the stack, so the scrubber marker sits between the right
 * slabs. Below average high tide it runs from the ground, and above the top slab it keeps the last
 * slab spacing.
 * @param levelAboveMhhw feet above average high tide
 * @param zOf height in meters of slab i
 */
export function markerZ(levelAboveMhhw: number, slabs: Slab[], zOf: (i: number) => number, lowFt = -7): number {
  const pts: [number, number][] = [[lowFt, 0], ...slabs.map((s, i) => [s.ft, zOf(i)] as [number, number])];
  if (levelAboveMhhw <= pts[0][0]) return 0;
  for (let i = 1; i < pts.length; i++) {
    const [f0, z0] = pts[i - 1];
    const [f1, z1] = pts[i];
    if (levelAboveMhhw <= f1) return f1 === f0 ? z1 : z0 + ((levelAboveMhhw - f0) * (z1 - z0)) / (f1 - f0);
  }
  const [fa, za] = pts[pts.length - 2];
  const [fb, zb] = pts[pts.length - 1];
  const perFt = fb > fa ? (zb - za) / (fb - fa) : zb - za;
  return Math.min(zb + zOf(0), zb + (levelAboveMhhw - fb) * perFt);
}

/** True when the stack has the merged slab. */
export const hasMerged = (slabs: Slab[]) => slabs.some((s) => s.kind === "merged");
