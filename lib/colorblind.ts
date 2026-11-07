// Deuteranopia simulation (Machado, Oliveira, and Fernandes 2009, severity 1.0) and CIE76 color difference.
const M = [
  [0.367322, 0.860646, -0.227968],
  [0.280085, 0.672501, 0.047413],
  [-0.01182, 0.04294, 0.968881],
];

const toLin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toSrgb = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
const parse = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const toHex = (rgb: number[]) => "#" + rgb.map((c) => Math.round(c * 255).toString(16).padStart(2, "0")).join("");

export function simulateDeuteranopia(hex: string): string {
  const lin = parse(hex).map(toLin);
  return toHex(M.map((row) => Math.min(1, Math.max(0, toSrgb(row[0] * lin[0] + row[1] * lin[1] + row[2] * lin[2])))));
}

function lab(hex: string): [number, number, number] {
  const [r, g, b] = parse(hex).map(toLin);
  const X = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047;
  const Y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const Z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : ((24389 / 27) * t + 16) / 116);
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
}

export const lightness = (hex: string) => lab(hex)[0];

export function deltaE(a: string, b: string): number {
  const A = lab(a);
  const B = lab(b);
  return Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]);
}
