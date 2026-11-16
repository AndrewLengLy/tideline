import { deltaE, lightness, simulateDeuteranopia } from "../lib/colorblind";
import { CITY, COLOR, STEP_COLORS } from "../lib/colors";

// Deuteranopia check (Machado, Oliveira, and Fernandes 2009, severity 1.0). Every pair also
// differs by a printed number, shape, or label, so color never carries meaning alone.
const PAIRS: [string, string, string][] = [
  ["water", "flood coral", "columns print their height in feet"],
  ["bay tint", "step 6", "flooded land carries a lighter edge and the slider prints the foot value"],
  ["calendar day under the line", "calendar day over the line", "days over the line also sit on a base tile, and the counter prints the total"],
  ["calendar day under the line, front", "calendar day over the line, front", "same base tile and counter"],
];

console.log("| Step | Color | Simulated | L* normal | L* simulated | Delta E to previous, simulated |");
console.log("| --- | --- | --- | --- | --- | --- |");
STEP_COLORS.forEach((c, i) => {
  const s = simulateDeuteranopia(c);
  const prev = i ? deltaE(s, simulateDeuteranopia(STEP_COLORS[i - 1])).toFixed(1) : "";
  console.log(`| ${i} ft | ${c} | ${s} | ${lightness(c).toFixed(1)} | ${lightness(s).toFixed(1)} | ${prev} |`);
});

console.log("\n| Pair | Normal delta E | Deuteranopia delta E | Second cue |");
console.log("| --- | --- | --- | --- |");
const named: Record<string, string> = {
  water: COLOR.water,
  "flood coral": COLOR.coral,
  "bay tint": COLOR.bay,
  "step 6": STEP_COLORS[6],
  "calendar day under the line": CITY.dryTop,
  "calendar day over the line": CITY.wetTop,
  "calendar day under the line, front": CITY.dryFront,
  "calendar day over the line, front": CITY.wetFront,
};
for (const [a, b, cue] of PAIRS) {
  const A = named[a];
  const B = named[b];
  console.log(`| ${a} vs ${b} | ${deltaE(A, B).toFixed(1)} | ${deltaE(simulateDeuteranopia(A), simulateDeuteranopia(B)).toFixed(1)} | ${cue} |`);
}
