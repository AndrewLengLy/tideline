// Confirms each station against the CO-OPS metadata API, adds any other active Bay gauge that
// has predictions, and writes data/stations.json with datums, thresholds, and flood day counts.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fetchHilo } from "../lib/sources/coops";
import { fetchDatums, fetchFloodCounts, fetchFloodLevels, fetchStationList } from "../lib/sources/metadata";
import { addDays, pacificDay } from "../lib/time";
import type { Station } from "../lib/types";

const KNOWN: Record<string, { slug: string; name: string; facing: number }> = {
  "9414290": { slug: "san-francisco", name: "San Francisco", facing: 15 },
  "9414750": { slug: "alameda", name: "Alameda", facing: 250 },
  "9414863": { slug: "richmond", name: "Richmond", facing: 235 },
  "9414523": { slug: "redwood-city", name: "Redwood City", facing: 45 },
  "9415144": { slug: "port-chicago", name: "Port Chicago", facing: 350 },
  "9415020": { slug: "point-reyes", name: "Point Reyes", facing: 130 },
  "9415102": { slug: "martinez", name: "Martinez", facing: 340 },
};

/** San Francisco Bay and the outer coast station at Point Reyes. */
const BAY = { minLat: 37.4, maxLat: 38.2, minLng: -123.1, maxLng: -121.9 };

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

async function main() {
  const [gauges, predictions] = await Promise.all([fetchStationList("waterlevels"), fetchStationList("tidepredictions")]);
  const predictionIds = new Set(predictions.stations.map((s) => s.id));
  const today = pacificDay(Date.now());

  const inBay = gauges.stations.filter((s) => s.lat >= BAY.minLat && s.lat <= BAY.maxLat && s.lng >= BAY.minLng && s.lng <= BAY.maxLng);
  console.log(`Active water level gauges in the Bay box: ${inBay.map((s) => `${s.id} ${s.name}`).join(", ")}`);
  for (const id of Object.keys(KNOWN)) {
    if (!inBay.some((s) => s.id === id)) throw new Error(`Station ${id} is missing from the active gauge list`);
  }

  const stations: Station[] = [];
  for (const g of inBay) {
    if (!predictionIds.has(g.id)) {
      console.log(`Skipping ${g.id} ${g.name}: no tide predictions`);
      continue;
    }
    const hilo = await fetchHilo(g.id, today, 2);
    if (!hilo.length) throw new Error(`Station ${g.id} returned no predictions`);
    const known = KNOWN[g.id] ?? { slug: slugify(g.name), name: g.name, facing: 0 };
    const { mhhwStnd, ...datums } = await fetchDatums(g.id);
    const [thresholds, counts] = await Promise.all([fetchFloodLevels(g.id, mhhwStnd), fetchFloodCounts(g.id)]);
    stations.push({
      id: g.id,
      slug: known.slug,
      name: known.name,
      noaaName: g.name,
      lat: g.lat,
      lng: g.lng,
      facing: known.facing,
      datums,
      thresholds,
      floodDays: counts.slice(-15),
    });
    console.log(
      `${g.id} ${known.name}: MHHW ${datums.mhhw} ft above MLLW, minor ${thresholds.minor ?? "none"}, action ${thresholds.action ?? "none"}, predictions confirmed through ${addDays(today, 1)}`,
    );
  }

  const order = Object.keys(KNOWN);
  stations.sort((a, b) => (order.indexOf(a.id) + 1 || 99) - (order.indexOf(b.id) + 1 || 99));
  const out = join(process.cwd(), "data", "stations.json");
  mkdirSync(join(process.cwd(), "data"), { recursive: true });
  writeFileSync(out, JSON.stringify({ generatedAt: new Date().toISOString(), stations }, null, 2) + "\n");
  console.log(`Wrote ${stations.length} stations to ${out}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
