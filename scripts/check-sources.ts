// Calls every data source Tideline depends on, once, and prints status, latency,
// record count, and a sample record. Pass --save-fixtures to refresh tests/fixtures.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const UA = "tideline/0.1 (+https://tides.andrewlengly.com)";
const ORIGIN = "https://tides.andrewlengly.com";
const DG = "https://api.tidesandcurrents.noaa.gov/api/prod/datagetter";
const MD = "https://api.tidesandcurrents.noaa.gov/mdapi/prod/webapi";
const DP = "https://api.tidesandcurrents.noaa.gov/dpapi/prod/webapi";
const SLR = "https://coast.noaa.gov/arcgis/rest/services/dc_slr";
const STATIONS = ["9414290", "9414750", "9414863", "9414523", "9415144", "9415020", "9415102"];
const SAVE = process.argv.includes("--save-fixtures");
const FIXTURES = join(process.cwd(), "tests", "fixtures");

interface Row {
  source: string;
  status: number | string;
  ms: number;
  records: string;
  sample: string;
}
const rows: Row[] = [];

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10).replaceAll("-", "");
}

function save(name: string, body: Buffer) {
  if (!SAVE) return;
  mkdirSync(FIXTURES, { recursive: true });
  writeFileSync(join(FIXTURES, name), body);
}

interface CheckOpts {
  source: string;
  url: string;
  kind?: "json" | "image" | "html";
  count?: (j: never) => number | string;
  sample?: (j: never) => unknown;
  fixture?: string;
  browserUa?: boolean;
}

async function check(o: CheckOpts) {
  const started = performance.now();
  const row: Row = { source: o.source, status: "error", ms: 0, records: "", sample: "" };
  try {
    const res = await fetch(o.url, {
      headers: { "User-Agent": o.browserUa ? "Mozilla/5.0" : UA, Origin: ORIGIN },
      signal: AbortSignal.timeout(45_000),
      redirect: "follow",
    });
    const buf = Buffer.from(await res.arrayBuffer());
    row.status = res.status;
    row.ms = Math.round(performance.now() - started);
    const cors = res.headers.get("access-control-allow-origin");
    if (o.kind === "image") {
      row.records = `${(buf.length / 1024).toFixed(1)} KB ${res.headers.get("content-type") ?? ""}`;
      row.sample = `CORS ${cors ?? "none"}`;
    } else if (o.kind === "html") {
      row.records = `${(buf.length / 1024).toFixed(0)} KB`;
      const title = /<title[^>]*>([^<]*)<\/title>/i.exec(buf.toString("utf8"))?.[1]?.trim();
      row.sample = title ?? "";
    } else {
      const j = JSON.parse(buf.toString("utf8"));
      row.records = String(o.count ? o.count(j as never) : "");
      row.sample = JSON.stringify(o.sample ? o.sample(j as never) : j).slice(0, 180);
    }
    if (o.fixture && res.ok) save(o.fixture, buf);
  } catch (e) {
    row.ms = Math.round(performance.now() - started);
    row.sample = e instanceof Error ? e.message : String(e);
  }
  rows.push(row);
}

async function main() {
  const now = new Date();
  const begin = new Date(now.getTime() - 3 * 86_400_000);
  const weekEnd = new Date(begin.getTime() + 7 * 86_400_000);
  const yearEnd = new Date(now.getTime() + 365 * 86_400_000);
  const common = "application=tideline&datum=MLLW&time_zone=lst_ldt&units=english&format=json";

  await check({
    source: "CO-OPS metadata, water level stations",
    url: `${MD}/stations.json?type=waterlevels`,
    fixture: "mdapi-stations-waterlevels-sample.json",
    count: (j: { stations: unknown[] }) => j.stations.length,
    sample: (j: { stations: { id: string; name: string; lat: number; lng: number }[] }) => {
      const s = j.stations.find((x) => x.id === "9414750");
      return s && { id: s.id, name: s.name, lat: s.lat, lng: s.lng };
    },
  });
  await check({
    source: "CO-OPS metadata, tide prediction stations",
    url: `${MD}/stations.json?type=tidepredictions`,
    count: (j: { stations: unknown[] }) => j.stations.length,
    sample: (j: { stations: { id: string; name: string; type: string }[] }) => {
      const s = j.stations.find((x) => x.id === "9414750");
      return s && { id: s.id, name: s.name, type: s.type };
    },
  });

  for (const id of STATIONS) {
    await check({
      source: `CO-OPS datums ${id}`,
      url: `${MD}/stations/${id}/datums.json?units=english`,
      fixture: id === "9414750" ? "datums-9414750.json" : undefined,
      count: (j: { datums: unknown[] }) => j.datums.length,
      sample: (j: { datums: { name: string; value: number }[]; epoch: string }) => ({
        epoch: j.epoch,
        MHHW: j.datums.find((d) => d.name === "MHHW")?.value,
        MLLW: j.datums.find((d) => d.name === "MLLW")?.value,
        MSL: j.datums.find((d) => d.name === "MSL")?.value,
      }),
    });
    await check({
      source: `CO-OPS flood levels ${id}`,
      url: `${MD}/stations/${id}/floodlevels.json?units=english`,
      fixture: id === "9414750" ? "floodlevels-9414750.json" : id === "9414523" ? "floodlevels-9414523.json" : undefined,
      count: (j: Record<string, unknown>) => Object.values(j).filter((v) => typeof v === "number").length,
      sample: (j: { nos_minor: number | null; nos_moderate: number | null; nos_major: number | null; nws_minor: number | null; action: number | null }) => ({
        nos_minor: j.nos_minor,
        nos_moderate: j.nos_moderate,
        nos_major: j.nos_major,
        nws_minor: j.nws_minor,
        action: j.action,
      }),
    });
    await check({
      source: `CO-OPS predictions, hilo, 12 months ${id}`,
      url: `${DG}?product=predictions&interval=hilo&station=${id}&begin_date=${ymd(now)}&end_date=${ymd(yearEnd)}&${common}`,
      fixture: id === "9414750" ? "predictions-hilo-9414750.json" : undefined,
      count: (j: { predictions: unknown[] }) => j.predictions.length,
      sample: (j: { predictions: unknown[] }) => j.predictions[1],
    });
    await check({
      source: `CO-OPS predictions, 6 min, 7 days ${id}`,
      url: `${DG}?product=predictions&interval=6&station=${id}&begin_date=${ymd(begin)}&end_date=${ymd(weekEnd)}&${common}`,
      fixture: id === "9414750" ? "predictions-6min-9414750.json" : undefined,
      count: (j: { predictions: unknown[] }) => j.predictions.length,
      sample: (j: { predictions: unknown[] }) => j.predictions[0],
    });
    await check({
      source: `CO-OPS water level, 72 h ${id}`,
      url: `${DG}?product=water_level&range=72&station=${id}&${common}`,
      fixture: id === "9414750" ? "water-level-9414750.json" : undefined,
      count: (j: { data: unknown[] }) => j.data.length,
      sample: (j: { data: unknown[] }) => j.data[j.data.length - 1],
    });
  }

  await check({
    source: "CO-OPS derived product, annual flood counts 9414750",
    url: `${DP}/htf/htf_met_year_annual.json?station=9414750`,
    fixture: "htf-met-year-9414750.json",
    count: (j: { count: number }) => j.count,
    sample: (j: { MetYearAnnualFloodCount: unknown[] }) => j.MetYearAnnualFloodCount.at(-1),
  });
  await check({
    source: "CO-OPS derived product, next year outlook 9414750",
    url: `${DP}/htf/htf_met_year_annual_outlook.json?station=9414750`,
    count: (j: { count: number }) => j.count,
    sample: (j: { MetYearAnnualOutlook: unknown[] }) => j.MetYearAnnualOutlook.at(-1),
  });

  // Tile at the Oakland airport shore, where low-lying, depth, and open water all appear.
  const tile = { z: 13, x: 1313, y: 3167 };
  for (let n = 0; n <= 10; n++) {
    await check({
      source: `NOAA SLR service slr_${n}ft`,
      url: `${SLR}/slr_${n}ft/MapServer?f=json`,
      count: (j: { layers: unknown[] }) => `${j.layers.length} layers`,
      sample: (j: { layers: { name: string }[]; tileInfo: { lods: unknown[] }; capabilities: string }) => ({
        layers: j.layers.map((l) => l.name),
        lods: j.tileInfo.lods.length,
        capabilities: j.capabilities,
      }),
    });
    await check({
      source: `NOAA SLR tile slr_${n}ft`,
      url: `${SLR}/slr_${n}ft/MapServer/tile/${tile.z}/${tile.y}/${tile.x}`,
      kind: "image",
      fixture: n === 0 || n === 6 ? `slr-${n}ft-tile.png` : undefined,
    });
    await check({
      source: `NOAA confidence tile conf_${n}ft`,
      url: `${SLR}/conf_${n}ft/MapServer/tile/${tile.z}/${tile.y}/${tile.x}`,
      kind: "image",
      fixture: n === 6 ? `conf-${n}ft-tile.png` : undefined,
    });
  }
  await check({
    source: "NOAA SLR legend slr_3ft",
    url: `${SLR}/slr_3ft/MapServer/legend?f=json`,
    count: (j: { layers: unknown[] }) => j.layers.length,
    sample: (j: { layers: { layerName: string; legend: { label: string }[] }[] }) => j.layers.map((l) => [l.layerName, l.legend.map((x) => x.label)]),
  });
  await check({
    source: "NOAA confidence legend conf_3ft",
    url: `${SLR}/conf_3ft/MapServer/legend?f=json`,
    count: (j: { layers: unknown[] }) => j.layers.length,
    sample: (j: { layers: { layerName: string; legend: { label: string }[] }[] }) => j.layers.map((l) => [l.layerName, l.legend.map((x) => x.label)]),
  });

  await check({
    source: "USGS National Map imagery tile",
    url: `https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/${tile.z}/${tile.y}/${tile.x}`,
    kind: "image",
  });
  await check({
    source: "AWS Terrain Tiles (Terrarium)",
    url: "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/12/656/1583.png",
    kind: "image",
  });
  await check({
    source: "OpenFreeMap TileJSON",
    url: "https://tiles.openfreemap.org/planet",
    count: (j: { vector_layers: unknown[] }) => `${j.vector_layers.length} vector layers`,
    sample: (j: { maxzoom: number; tiles: string[] }) => ({ maxzoom: j.maxzoom, tiles: j.tiles }),
  });
  await check({
    source: "OpenFreeMap Liberty style",
    url: "https://tiles.openfreemap.org/styles/liberty",
    count: (j: { layers: unknown[] }) => `${j.layers.length} layers`,
    sample: (j: { glyphs: string }) => ({ glyphs: j.glyphs }),
  });
  await check({
    source: "OpenFreeMap glyphs",
    url: "https://tiles.openfreemap.org/fonts/Noto%20Sans%20Regular/0-255.pbf",
    kind: "image",
  });

  const pages: [string, string][] = [
    ["California King Tides Project", "https://www.coastal.ca.gov/kingtides/"],
    ["King Tides how to participate", "https://www.coastal.ca.gov/kingtides/participate.html"],
    ["King Tides photo upload form", "https://survey123.arcgis.com/share/046c76a1ffa14902bb8ab2d6bb874456"],
    ["NWS Bay Area", "https://www.weather.gov/mtr"],
    ["NOAA Tides and Currents", "https://tidesandcurrents.noaa.gov"],
    ["NOAA SLR Viewer", "https://coast.noaa.gov/slr/"],
    ["USGS CoSMoS (Our Coast, Our Future) site", "https://ourcoastourfuture.org/"],
  ];
  for (const [source, url] of pages) await check({ source, url, kind: "html", browserUa: true });
  await check({
    source: "USGS CoSMoS map service probe",
    url: "https://cmgds.marine.usgs.gov/arcgis/rest/services?f=json",
    kind: "html",
  });

  console.log("| Source | Status | Latency | Records | Sample |");
  console.log("| --- | --- | --- | --- | --- |");
  for (const r of rows) {
    console.log(`| ${r.source} | ${r.status} | ${r.ms.toLocaleString("en-US")} ms | ${r.records} | ${r.sample.replaceAll("|", "/")} |`);
  }
  const bad = rows.filter((r) => r.status !== 200);
  console.log(`\n${rows.length - bad.length} of ${rows.length} calls returned 200.`);
  for (const r of bad) console.log(`Not 200: ${r.source} (${r.status}) ${r.sample}`);
  if (SAVE) console.log(`Fixtures written to ${FIXTURES}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
