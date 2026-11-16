/** One line per range, from the State of California Sea Level Rise Guidance, 2024 (statewide figures). */
export function sliderTip(ft: number, kingEq: number | null): string {
  const king = kingEq !== null && ft > 0 && Math.round(kingEq) === ft ? "The next king tide previews this level. " : "";
  if (ft === 0) return "0 ft is today's high-tide line, the bright edge on the map. An ordinary high tide stops there.";
  if (ft === 1) return `${king}The state expects about 0.8 ft of rise by 2050.`;
  if (ft <= 3) return `${king}The state's likely range for 2100 is 1.6 to 3.1 ft.`;
  if (ft <= 6) return `${king}This is past the likely 2100 range. The state's high scenario reaches 6.6 ft by 2100.`;
  return `${king}This is past every 2100 scenario. The state's range for 2150 runs as high as 11.9 ft.`;
}
