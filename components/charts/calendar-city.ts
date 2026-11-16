// Geometry for the calendar city: 12 months of days as blocks, one week per column and one
// weekday per row. Rows recede up and to the right, so each block shows a top, a front, and a
// right side. Faces of one color and row share a single path, which keeps a slider frame to a few
// dozen attribute writes.
import { crossesLine } from "@/lib/metrics/days-over";
import { addDays } from "@/lib/time";

/** Screen shift per row toward the viewer. Front rows sit lower and further left. */
const ROW_DX = -2.4;
const ROW_DY = 4.3;
/** Block depth as a share of the row pitch. */
const DEPTH = 0.72;
const TOP_PAD = 13;
const BOTTOM_PAD = 2;
/** Heights scale to fit this much added water. Past it every day is over the line, so taller blocks stop at the top. */
const MAX_ADD_FT = 4;

export interface CityInput {
  max: (number | null)[];
  start: string;
  mhhw: number;
  /** Counting line in feet above MHHW, or null when the gauge has none. */
  lineFt: number | null;
  w: number;
  h: number;
}

export interface CityLayout {
  cols: number;
  /** Weekday of the first day, Sunday 0. */
  offset: number;
  cw: number;
  bw: number;
  x0: number;
  yBack: number;
  /** Pixels per foot of water. */
  k: number;
  /** Feet above MHHW drawn at ground level. */
  floorFt: number;
  maxH: number;
}

export function weekday(day: string): number {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Static layout. Only heights and colors change when the slider moves. */
export function cityLayout({ max, start, mhhw, w, h }: CityInput): CityLayout {
  const offset = start ? weekday(start) : 0;
  const cols = Math.max(1, Math.ceil((offset + max.length) / 7));
  const shift = 6 * -ROW_DX + DEPTH * -ROW_DX;
  const x0 = 2 + shift;
  const cw = Math.max(2, (w - x0 - 4) / cols);
  const bw = Math.max(1.2, cw - DEPTH * -ROW_DX - Math.min(0.9, cw * 0.12));
  const yBack = h - BOTTOM_PAD - (6 + DEPTH) * ROW_DY;
  let lo = Infinity;
  let hi = -Infinity;
  for (const v of max) {
    if (v === null) continue;
    lo = Math.min(lo, v - mhhw);
    hi = Math.max(hi, v - mhhw);
  }
  if (!Number.isFinite(lo)) {
    lo = -1;
    hi = 1;
  }
  const floorFt = Math.floor(lo * 2) / 2 - 0.5;
  const maxH = Math.max(8, yBack - TOP_PAD);
  const k = maxH / (hi + MAX_ADD_FT - floorFt);
  return { cols, offset, cw, bw, x0, yBack, k, floorFt, maxH };
}

/** Column and row for day i. */
export const cell = (L: CityLayout, i: number) => ({ c: Math.floor((L.offset + i) / 7), r: (L.offset + i) % 7 });

/** Screen point for a column position, a row position, and a height in pixels. */
const pt = (L: CityLayout, colX: number, rowZ: number, hPx: number): [number, number] => [L.x0 + colX * L.cw + rowZ * ROW_DX, L.yBack + rowZ * ROW_DY - hPx];

const poly = (pts: [number, number][]) => `M${pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join("L")}Z`;
const r1 = (v: number) => Math.round(v * 10) / 10;

export const blockHeight = (L: CityLayout, v: number, mhhw: number, addFt: number) => Math.min(L.maxH, Math.max(1.5, (v + addFt - mhhw - L.floorFt) * L.k));

/**
 * The faces of one block: top, front, and right side. Relative path commands keep each face to
 * about 25 characters, since a slider step rewrites every face in the city.
 */
export function blockFaces(L: CityLayout, c: number, r: number, hPx: number) {
  const [fx, fy] = pt(L, c, r + DEPTH, 0);
  const x = r1(fx);
  const yb = r1(fy);
  const yt = r1(fy - hPx);
  const bw = r1(L.bw);
  const dx = r1(-DEPTH * ROW_DX);
  const dy = r1(DEPTH * ROW_DY);
  const h = r1(yb - yt);
  const top = `M${x} ${yt}h${bw}l${dx} -${dy}h-${bw}z`;
  const front = `M${x} ${yb}h${bw}v-${h}h-${bw}z`;
  const side = `M${r1(x + bw)} ${yb}l${dx} -${dy}v-${h}l-${dx} ${dy}z`;
  return { top, front, side };
}

/** The ground tile under a block, a little wider so its edge shows. */
export function baseTile(L: CityLayout, c: number, r: number) {
  const m = 0.16;
  const [x, y] = pt(L, c - m, r + DEPTH + m * 0.6, 0);
  const w = r1(L.bw + 2 * m * L.cw);
  const d = DEPTH + 1.2 * m;
  return `M${r1(x)} ${r1(y)}h${w}l${r1(-d * ROW_DX)} -${r1(d * ROW_DY)}h-${w}z`;
}

/** The block outline, for the hovered day. */
export function blockOutline(L: CityLayout, c: number, r: number, hPx: number): string {
  const bwf = L.bw / L.cw;
  return poly([pt(L, c, r + DEPTH, 0), pt(L, c + bwf, r + DEPTH, 0), pt(L, c + bwf, r, 0), pt(L, c + bwf, r, hPx), pt(L, c, r, hPx), pt(L, c, r + DEPTH, hPx)]);
}

export interface RowPaths {
  base: string;
  empty: string;
  dry: { top: string; front: string; side: string };
  wet: { top: string; front: string; side: string };
}

export interface CityPaths {
  rows: RowPaths[];
  count: number;
}

/** Every face, grouped by row and color, plus the flood-day count for this added height. */
export function cityPaths(L: CityLayout, input: Pick<CityInput, "max" | "mhhw" | "lineFt">, addFt: number): CityPaths {
  const rows: RowPaths[] = Array.from({ length: 7 }, () => ({ base: "", empty: "", dry: { top: "", front: "", side: "" }, wet: { top: "", front: "", side: "" } }));
  let count = 0;
  input.max.forEach((v, i) => {
    const { c, r } = cell(L, i);
    const row = rows[r];
    if (v === null) {
      row.empty += baseTile(L, c, r);
      return;
    }
    const wet = input.lineFt !== null && crossesLine(v, addFt, input.mhhw, input.lineFt);
    const f = blockFaces(L, c, r, blockHeight(L, v, input.mhhw, addFt));
    const set = wet ? row.wet : row.dry;
    if (wet) {
      count++;
      row.base += baseTile(L, c, r);
    }
    set.top += f.top;
    set.front += f.front;
    set.side += f.side;
  });
  return { rows, count };
}

/** Month initials along the top edge, at the column holding each month's first day. */
export function monthMarks(L: CityLayout, start: string, n: number): { x: number; label: string }[] {
  const out: { x: number; label: string }[] = [];
  for (let i = 0; i < n; i++) {
    const day = addDays(start, i);
    if (i !== 0 && !day.endsWith("-01")) continue;
    if (i === 0 && Number(day.slice(8)) > 7) continue;
    const { c } = cell(L, i);
    const month = Number(day.slice(5, 7));
    out.push({ x: L.x0 + c * L.cw, label: "JFMAMJJASOND"[month - 1] });
  }
  return out;
}

/** The day under a point, front rows first since they hide the rows behind. Null over open ground. */
export function hitTest(L: CityLayout, input: Pick<CityInput, "max" | "mhhw">, addFt: number, x: number, y: number): number | null {
  for (let r = 6; r >= 0; r--) {
    const guess = Math.floor((x - L.x0 - r * ROW_DX) / L.cw);
    for (const c of [guess, guess - 1]) {
      const i = c * 7 + r - L.offset;
      if (i < 0 || i >= input.max.length) continue;
      const v = input.max[i];
      if (v === null) continue;
      const hPx = blockHeight(L, v, input.mhhw, addFt);
      const [ax] = pt(L, c, r + DEPTH, 0);
      const [bx] = pt(L, c + L.bw / L.cw, r, 0);
      const yTop = pt(L, c, r, hPx)[1];
      const yBottom = pt(L, c, r + DEPTH, 0)[1];
      if (x >= ax - 0.5 && x <= bx + 0.5 && y >= yTop - 0.5 && y <= yBottom + 0.5) return i;
    }
  }
  return null;
}

/** Top center of a block, where the tooltip points. */
export function blockTop(L: CityLayout, i: number, hPx: number): [number, number] {
  const { c, r } = cell(L, i);
  return pt(L, c + L.bw / L.cw / 2, r + DEPTH / 2, hPx);
}

export const dayOf = (start: string, i: number) => addDays(start, i);
