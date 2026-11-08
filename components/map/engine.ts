// The imperative map: MapLibre with an interleaved deck.gl overlay. React holds the state and
// calls these methods. Nothing here renders React, so tide playback never re-renders the page.
import maplibregl from "maplibre-gl";
import type { Map as MLMap, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { MapboxOverlay } from "@deck.gl/mapbox";
import { ColumnLayer, IconLayer, TextLayer } from "@deck.gl/layers";
import { COLOR, hexToRgb } from "@/lib/colors";
import { vsHighTide } from "@/lib/format";
import { SLR_MAX_ZOOM } from "@/lib/sources/slr";
import { DEFAULT_LAYERS, type LayerSettings } from "./layers";
import { registerProtocols, type SlrPaint } from "./protocols";
import { baseStyle, BEFORE_BUILDINGS, BEFORE_FLOOD_LAYERS, BEFORE_WATER_LAYERS } from "./style";

/** The poster stays up until imagery paints. After this long the canvas shows whatever has arrived. */
const REVEAL_CAP_MS = 8000;
const REVEAL_FADE_MS = 250;

export interface ViewState {
  lat: number;
  lng: number;
  zoom: number;
  pitch: number;
  bearing: number;
}

export interface GaugeDatum {
  id: string;
  name: string;
  lng: number;
  lat: number;
  /** Water level at the scrubber time, feet above MHHW. */
  level: number;
  /** Minor flood threshold in feet above MHHW, when NOAA publishes one. */
  minor: number | null;
  selected: boolean;
}

export interface CalloutItem {
  id: string;
  lng: number;
  lat: number;
  title: string;
  detail: string;
  /** Lower draws first and wins collisions. */
  priority: number;
  kind: "king" | "spot";
  href?: string;
}

export interface EngineOptions {
  container: HTMLElement;
  view: ViewState;
  phone: boolean;
  webgl2: boolean;
  /** Second map used for compare mode. It carries no deck overlay and no callouts. */
  secondary?: boolean;
  ariaLabel: string;
  reducedMotion: boolean;
  padding: { top: number; right: number; bottom: number; left: number };
  onView?: (v: ViewState) => void;
  onLive?: (v: ViewState) => void;
  onStage?: (stage: "base" | "full") => void;
  onPickGauge?: (id: string) => void;
}

const WATER_RGB = hexToRgb(COLOR.water);
const CORAL_RGB = hexToRgb(COLOR.coral);
const INK_RGB = hexToRgb(COLOR.ink);

/** The staff starts this far below MHHW, so a low tide still has height. */
const PEDESTAL_FT = 7;
const FRAME_FT = 10;
const PERSON_FT = 6;
/** A 6 ft person who stands on the high-tide line beside each staff. Drawn as a mask and tinted ink. */
const PERSON_ICON = {
  url: `data:image/svg+xml;utf8,${encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' width='40' height='120' viewBox='0 0 40 120'><circle cx='20' cy='10.5' r='9.5'/><path d='M11 23h18a6 6 0 0 1 6 6v36h-6.5v54h-7.5V71h-2v48h-7.5V65H5V29a6 6 0 0 1 6-6z'/></svg>")}`,
  width: 40,
  height: 120,
  anchorY: 120,
  mask: true,
};

interface Tick {
  g: GaugeDatum;
  /** Feet above MHHW. */
  ft: number;
  kind: "foot" | "mhhw" | "minor";
}
const WATER_TWEEN_MS = 130;
const WATER_OPACITY = 0.78;
const MAX_LIVE_STEPS = 4;
const WATER_LINE_ANCHOR = "water-line-anchor";

const TERRAIN_SRC = "terrain-dem";
const HILLSHADE_SRC = "hillshade-dem";

/** Ground meters per CSS pixel at a latitude and zoom. */
const metersPerPixel = (lat: number, zoom: number) => (156543.03392 * Math.cos((lat * Math.PI) / 180)) / 2 ** zoom / 2;

export class TideEngine {
  readonly map: MLMap;
  private overlay: MapboxOverlay | null = null;
  private opts: EngineOptions;
  private layers: LayerSettings = DEFAULT_LAYERS;
  private exaggeration = 3;
  private threeD = true;
  private heavyLoaded = false;
  /** True from the first load event onward. isStyleLoaded() goes false whenever a tile is in flight, so it cannot gate setters. */
  private ready = false;
  private revealed = false;
  private revealTimer?: ReturnType<typeof setTimeout>;
  private waterTarget = 0;
  private waterShown = 0;
  private waterRaf = 0;
  private confFt = 0;
  private liveSteps: number[] = [];
  private gauges: GaugeDatum[] = [];
  private callouts: CalloutItem[] = [];
  private markers = new Map<string, { marker: Marker; el: HTMLElement; item: CalloutItem }>();
  private calloutRaf = 0;
  private destroyed = false;
  private monoFamily = "monospace";

  constructor(opts: EngineOptions) {
    this.opts = opts;
    registerProtocols();
    const { view } = opts;
    this.map = new maplibregl.Map({
      container: opts.container,
      style: baseStyle(),
      center: [view.lng, view.lat],
      zoom: view.zoom,
      pitch: opts.webgl2 ? view.pitch : 0,
      bearing: opts.webgl2 ? view.bearing : 0,
      maxPitch: 80,
      pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
      attributionControl: false,
      fadeDuration: opts.reducedMotion ? 0 : 200,
      canvasContextAttributes: { antialias: true },
      locale: { "Map.Title": opts.ariaLabel },
    });
    this.map.setPadding(opts.padding);
    if (!opts.secondary) this.map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-left");
    if (!opts.secondary) this.map.addControl(new maplibregl.ScaleControl({ unit: "imperial", maxWidth: 110 }), "bottom-right");
    // MapLibre opens a compact attribution on load. Credits also sit in the footer, so it starts closed.
    const closeAttribution = () => {
      const el = opts.container.querySelector(".maplibregl-ctrl-attrib");
      el?.classList.remove("maplibregl-compact-show");
      el?.removeAttribute("open");
    };

    if (opts.webgl2 && !opts.secondary) {
      this.overlay = new MapboxOverlay({ interleaved: true, layers: [] });
      this.map.addControl(this.overlay as unknown as maplibregl.IControl);
      this.monoFamily = getComputedStyle(document.documentElement).getPropertyValue("--font-plex").trim() || "monospace";
    }

    // The opaque land layer would cover the poster with flat color until imagery arrives, so the canvas stays transparent.
    if (opts.secondary) {
      this.revealed = true;
    } else {
      this.map.getCanvas().style.opacity = "0";
      this.revealTimer = setTimeout(() => this.reveal(), REVEAL_CAP_MS);
      // A gesture reveals right away. Setup calls like setPadding also fire movestart, without an originalEvent.
      this.map.on("movestart", (e) => {
        if (e.originalEvent) this.reveal();
      });
      this.map.on("sourcedata", (e) => {
        if (e.sourceId === "imagery" && e.tile && this.map.isSourceLoaded("imagery")) this.reveal();
      });
    }

    this.map.on("load", () => {
      if (this.destroyed) return;
      this.ready = true;
      closeAttribution();
      this.opts.onStage?.("base");
      this.setWater(this.waterTarget, true);
      this.renderFlatGauges();
      const idle = window.requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 200));
      idle(() => this.loadHeavyLayers());
    });
    this.map.on("moveend", () => this.opts.onView?.(this.getView()));
    this.map.on("move", () => {
      this.opts.onLive?.(this.getView());
      this.scheduleCallouts();
      this.renderDeck();
    });
    this.map.on("idle", () => {
      // Idle can fire before the imagery source exists, when the flat basemap alone has finished.
      if (this.heavyLoaded) this.reveal();
      this.scheduleCallouts();
    });
  }

  /** Fades the canvas in over the poster, then places the callouts. */
  private reveal() {
    if (this.revealed || this.destroyed) return;
    this.revealed = true;
    clearTimeout(this.revealTimer);
    const canvas = this.map.getCanvas();
    canvas.style.transition = `opacity ${this.opts.reducedMotion ? "0.01ms" : `${REVEAL_FADE_MS}ms ease-out`}`;
    canvas.style.opacity = "1";
    this.scheduleCallouts();
  }

  getView(): ViewState {
    const c = this.map.getCenter();
    return { lat: c.lat, lng: c.lng, zoom: this.map.getZoom(), pitch: this.map.getPitch(), bearing: this.map.getBearing() };
  }

  /** Terrain, imagery, hillshade, and buildings arrive only after the flat basemap has painted. */
  private loadHeavyLayers() {
    const m = this.map;
    if (this.destroyed || this.heavyLoaded) return;
    this.heavyLoaded = true;

    m.addSource("imagery", {
      type: "raster",
      tiles: ["https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/{z}/{y}/{x}"],
      tileSize: 256,
      maxzoom: 16,
      attribution: '<a href="https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer">USGS National Map imagery</a>',
    });
    m.addLayer(
      {
        id: "imagery",
        type: "raster",
        source: "imagery",
        layout: { visibility: this.layers.imagery.on ? "visible" : "none" },
        paint: {
          "raster-opacity": this.layers.imagery.opacity,
          "raster-saturation": -0.22,
          "raster-hue-rotate": -5,
          "raster-contrast": -0.06,
          "raster-brightness-min": 0.08,
          "raster-brightness-max": 1,
          "raster-fade-duration": this.opts.reducedMotion ? 0 : 200,
        },
      },
      BEFORE_WATER_LAYERS,
    );

    if (this.opts.webgl2) {
      const dem = { type: "raster-dem" as const, tiles: ["tideterrain://{z}/{x}/{y}"], encoding: "terrarium" as const, tileSize: 256, maxzoom: 15, attribution: '<a href="https://registry.opendata.aws/terrain-tiles/">AWS Terrain Tiles (Mapzen)</a>' };
      m.addSource(TERRAIN_SRC, dem);
      m.addSource(HILLSHADE_SRC, dem);
      m.addLayer(
        {
          id: "hillshade",
          type: "hillshade",
          source: HILLSHADE_SRC,
          layout: { visibility: this.layers.terrain.on ? "visible" : "none" },
          paint: {
            "hillshade-exaggeration": this.layers.terrain.opacity,
            "hillshade-shadow-color": "#2c3a44",
            "hillshade-highlight-color": "#fff8ec",
            "hillshade-accent-color": "#5e6a70",
            "hillshade-illumination-direction": 315,
          },
        },
        BEFORE_WATER_LAYERS,
      );
      if (this.threeD && this.layers.terrain.on) m.setTerrain({ source: TERRAIN_SRC, exaggeration: this.exaggeration });
    }

    m.addLayer(
      {
        id: "building",
        type: "fill-extrusion",
        source: "ofm",
        "source-layer": "building",
        minzoom: this.opts.phone ? 15 : 14,
        filter: ["!=", ["get", "hide_3d"], true],
        layout: { visibility: this.layers.buildings.on && this.threeD ? "visible" : "none" },
        paint: {
          "fill-extrusion-color": COLOR.building,
          "fill-extrusion-opacity": this.layers.buildings.opacity,
          "fill-extrusion-height": ["coalesce", ["get", "render_height"], 4],
          "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
        },
      },
      BEFORE_BUILDINGS,
    );

    this.setConfidenceLayer();
    this.opts.onStage?.("full");
    this.renderDeck();
    this.renderFlatGauges();
  }

  // Water -----------------------------------------------------------------
  //
  // Each whole foot has three raster layers: the fill, the band of land that goes under between
  // that foot and the next, and the waterline. A level of 2.4 ft shows the 2 ft fill, the 2 to
  // 3 ft band at 40 percent, and crossfades the 2 ft and 3 ft waterlines. Level changes ease
  // over a short tween, so dragging the slider or playing the tide moves the shoreline smoothly.

  private ensureLayer(kind: SlrPaint, ft: number) {
    const m = this.map;
    const id = `slr-${kind}-${ft}`;
    if (!m.getSource(id)) {
      m.addSource(id, {
        type: "raster",
        tiles: [`tideslr://${kind}/${ft}/{z}/{y}/{x}`],
        tileSize: 256,
        maxzoom: SLR_MAX_ZOOM,
        attribution: '<a href="https://coast.noaa.gov/slr/">NOAA Sea Level Rise Viewer</a>',
      });
    }
    if (!m.getLayer(id)) {
      // Fills and bands sit under the waterline anchor, and every waterline sits above it.
      const before = kind === "edge" ? (m.getLayer(BEFORE_FLOOD_LAYERS) ? BEFORE_FLOOD_LAYERS : undefined) : WATER_LINE_ANCHOR;
      m.addLayer(
        {
          id,
          type: "raster",
          source: id,
          paint: { "raster-opacity": 0, "raster-opacity-transition": { duration: 0, delay: 0 }, "raster-fade-duration": 0, "raster-resampling": kind === "edge" ? "nearest" : "linear" },
        },
        before,
      );
    }
  }

  private ensureAnchor() {
    const m = this.map;
    if (m.getLayer(WATER_LINE_ANCHOR)) return;
    m.addLayer({ id: WATER_LINE_ANCHOR, type: "background", layout: { visibility: "none" } }, m.getLayer(BEFORE_FLOOD_LAYERS) ? BEFORE_FLOOD_LAYERS : undefined);
  }

  private touchStep(ft: number) {
    this.liveSteps = [ft, ...this.liveSteps.filter((s) => s !== ft)];
  }

  /** Sets the water level in feet above today's MHHW. Fractions are fine. The map eases to it. */
  setWater(level: number, force = false) {
    const next = Math.max(0, Math.min(10, level));
    const changed = next !== this.waterTarget;
    this.waterTarget = next;
    if (!this.ready) {
      this.waterShown = next;
      return;
    }
    if (!changed && !force) return;
    if (force || this.opts.reducedMotion) {
      this.waterShown = next;
      this.paintWater();
      return;
    }
    if (!this.waterRaf) {
      let last = performance.now();
      const tick = (now: number) => {
        const dt = Math.min(64, now - last);
        last = now;
        const gap = this.waterTarget - this.waterShown;
        // Exponential ease toward the target, about 90 percent of the way in 300 ms.
        const step = gap * (1 - Math.exp(-dt / WATER_TWEEN_MS));
        this.waterShown = Math.abs(gap) < 0.01 ? this.waterTarget : this.waterShown + step;
        this.paintWater();
        this.waterRaf = this.waterShown === this.waterTarget || this.destroyed ? 0 : requestAnimationFrame(tick);
      };
      this.waterRaf = requestAnimationFrame(tick);
    }
  }

  /** The level the map is showing right now, mid-tween included. */
  get waterLevel() {
    return this.waterShown;
  }

  private paintWater() {
    const m = this.map;
    const level = this.waterShown;
    const lo = Math.floor(level);
    const f = lo >= 10 ? 0 : level - lo;
    const hi = Math.min(10, lo + 1);
    this.ensureAnchor();
    const fillOn = this.layers.slr.on ? this.layers.slr.opacity : 0;
    const want = new Map<string, number>();
    want.set(`slr-fill-${lo}`, fillOn * WATER_OPACITY);
    want.set(`slr-edge-${lo}`, fillOn * (1 - f));
    this.touchStep(lo);
    if (f > 0.001) {
      want.set(`slr-band-${lo}`, fillOn * WATER_OPACITY * f);
      want.set(`slr-edge-${hi}`, fillOn * f);
      this.touchStep(hi);
    }
    for (const id of want.keys()) {
      const [, kind, ft] = id.split("-");
      this.ensureLayer(kind as SlrPaint, Number(ft));
    }
    for (const id of m.getLayersOrder()) {
      if (!id.startsWith("slr-")) continue;
      const v = want.get(id) ?? 0;
      if (m.getPaintProperty(id, "raster-opacity") !== v) m.setPaintProperty(id, "raster-opacity", v);
    }
    // Forget the least recent steps so a long slider session does not hold every tile set.
    while (this.liveSteps.length > MAX_LIVE_STEPS) {
      const old = this.liveSteps.pop()!;
      for (const kind of ["fill", "band", "edge"] as const) {
        const id = `slr-${kind}-${old}`;
        if (m.getLayer(id)) m.removeLayer(id);
        if (m.getSource(id)) m.removeSource(id);
      }
    }
    const conf = Math.round(level);
    if (conf !== this.confFt) {
      this.confFt = conf;
      this.setConfidenceLayer();
    }
  }

  private setConfidenceLayer() {
    const m = this.map;
    if (!this.heavyLoaded) return;
    const ft = this.confFt;
    for (const layer of m.getLayersOrder().filter((l) => l.startsWith("conf-") && l !== `conf-${ft}`)) {
      m.removeLayer(layer);
      m.removeSource(layer);
    }
    if (!this.layers.confidence.on) {
      if (m.getLayer(`conf-${ft}`)) {
        m.removeLayer(`conf-${ft}`);
        m.removeSource(`conf-${ft}`);
      }
      return;
    }
    const id = `conf-${ft}`;
    if (!m.getSource(id)) {
      m.addSource(id, { type: "raster", tiles: [`tideconf://${ft}/{z}/{y}/{x}`], tileSize: 256, maxzoom: SLR_MAX_ZOOM });
      m.addLayer({ id, type: "raster", source: id, paint: { "raster-opacity": this.layers.confidence.opacity, "raster-fade-duration": 0 } }, BEFORE_FLOOD_LAYERS);
    } else {
      m.setPaintProperty(id, "raster-opacity", this.layers.confidence.opacity);
    }
  }

  // Layers ----------------------------------------------------------------

  setLayers(next: LayerSettings) {
    const m = this.map;
    this.layers = next;
    if (!this.ready) return;
    if (m.getLayer("imagery")) {
      m.setLayoutProperty("imagery", "visibility", next.imagery.on ? "visible" : "none");
      m.setPaintProperty("imagery", "raster-opacity", next.imagery.opacity);
    }
    if (m.getLayer("hillshade")) {
      m.setLayoutProperty("hillshade", "visibility", next.terrain.on ? "visible" : "none");
      m.setPaintProperty("hillshade", "hillshade-exaggeration", next.terrain.opacity);
    }
    if (m.getLayer("building")) {
      m.setLayoutProperty("building", "visibility", next.buildings.on && this.threeD ? "visible" : "none");
      m.setPaintProperty("building", "fill-extrusion-opacity", next.buildings.opacity);
    }
    this.syncTerrain();
    this.paintWater();
    this.setConfidenceLayer();
    this.renderDeck();
    this.renderFlatGauges();
    this.scheduleCallouts();
  }

  private syncTerrain() {
    const m = this.map;
    if (!m.getSource(TERRAIN_SRC)) return;
    const want = this.threeD && this.layers.terrain.on;
    const has = !!m.getTerrain();
    if (want) {
      if (!has || m.getTerrain()?.exaggeration !== this.exaggeration) m.setTerrain({ source: TERRAIN_SRC, exaggeration: this.exaggeration });
    } else if (has) {
      m.setTerrain(null);
    }
  }

  setExaggeration(x: number) {
    this.exaggeration = x;
    this.syncTerrain();
    this.renderDeck();
  }

  set3D(on: boolean) {
    if (on === this.threeD) return;
    this.threeD = on;
    this.syncTerrain();
    if (this.map.getLayer("building")) this.map.setLayoutProperty("building", "visibility", on && this.layers.buildings.on ? "visible" : "none");
    const duration = this.opts.reducedMotion ? 0 : 400;
    if (on) this.map.easeTo({ pitch: this.opts.phone ? 55 : 62, bearing: 70, duration });
    else this.map.easeTo({ pitch: 0, bearing: 0, duration });
    this.renderDeck();
    this.renderFlatGauges();
  }

  resetBearing() {
    this.map.easeTo({ bearing: 0, duration: this.opts.reducedMotion ? 0 : 300 });
  }

  /** Flies to a place over 1.2 s and ends pitched at 60 facing the water. */
  flyTo(lng: number, lat: number, facing: number, zoom = 13.4) {
    this.map.flyTo({
      center: [lng, lat],
      zoom,
      pitch: this.threeD ? 60 : 0,
      bearing: this.threeD ? facing : 0,
      duration: this.opts.reducedMotion ? 0 : 1200,
      essential: true,
    });
  }

  jumpTo(v: ViewState) {
    this.map.jumpTo({ center: [v.lng, v.lat], zoom: v.zoom, pitch: v.pitch, bearing: v.bearing });
  }

  // Gauges ----------------------------------------------------------------

  setGauges(gauges: GaugeDatum[]) {
    this.gauges = gauges;
    this.renderDeck();
    this.renderFlatGauges();
  }

  /** Circles with printed heights, for 2D mode and browsers with no WebGL2. */
  private renderFlatGauges() {
    const m = this.map;
    if (this.opts.secondary || !this.ready) return;
    const show = this.layers.thresholds.on && (!this.threeD || !this.overlay);
    const features = (show ? this.gauges : []).map((d) => ({
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: [d.lng, d.lat] },
      properties: { over: d.minor !== null && d.level > d.minor, label: `${d.name}\n${vsHighTide(d.level)}` },
    }));
    const data = { type: "FeatureCollection" as const, features };
    const source = m.getSource("gauges-flat") as maplibregl.GeoJSONSource | undefined;
    if (source) {
      source.setData(data);
      return;
    }
    m.addSource("gauges-flat", { type: "geojson", data });
    m.addLayer({
      id: "gauges-flat-dot",
      type: "circle",
      source: "gauges-flat",
      paint: { "circle-radius": 6, "circle-color": ["case", ["get", "over"], COLOR.coral, COLOR.water], "circle-stroke-color": COLOR.ink, "circle-stroke-width": 1 },
    });
    m.addLayer({
      id: "gauges-flat-label",
      type: "symbol",
      source: "gauges-flat",
      layout: { "text-field": ["get", "label"], "text-font": ["Noto Sans Bold"], "text-size": 12, "text-offset": [0, 1.1], "text-anchor": "top", "text-allow-overlap": true },
      paint: { "text-color": COLOR.ink, "text-halo-color": "#f8fafb", "text-halo-width": 1.6 },
    });
  }

  private groundZ(lng: number, lat: number): number {
    if (!this.map.getTerrain()) return 0;
    const raw = this.map.queryTerrainElevation([lng, lat]);
    return raw === null || raw === undefined ? 0 : Math.max(0, raw);
  }

  private renderDeck() {
    if (!this.overlay) return;
    const on = this.layers.thresholds.on;
    const alpha = Math.round(this.layers.thresholds.opacity * 255);
    const zoom = this.map.getZoom();
    const lat = this.map.getCenter().lat;
    const mpp = metersPerPixel(lat, zoom);
    // Tide range is 2 m and the view spans 30 km, so staffs draw at a screen-based scale and print their true height.
    const pxPerFt = (this.opts.phone ? 8.5 : 12) * (this.threeD ? this.exaggeration / 3 : 1);
    const scale = pxPerFt * mpp;
    const radius = (this.opts.phone ? 5.5 : 7) * mpp;
    const data = on && this.threeD ? this.gauges : [];

    const base = (d: GaugeDatum) => this.groundZ(d.lng, d.lat);
    const mhhwZ = (d: GaugeDatum) => base(d) + PEDESTAL_FT * scale;
    // The person stands to the screen right of the staff, whatever the bearing.
    const rad = (this.map.getBearing() * Math.PI) / 180;
    const sideM = radius * 4.2;
    const beside = (d: GaugeDatum): [number, number] => [
      d.lng + (sideM * Math.cos(rad)) / (111320 * Math.cos((d.lat * Math.PI) / 180)),
      d.lat - (sideM * Math.sin(rad)) / 110540,
    ];
    // deck.gl scales billboard text with camera distance. Dividing by the local map scale keeps labels one size.
    const labelScale = (d: GaugeDatum) => {
      const dMeters = 200 * mpp;
      const dLng = (dMeters * Math.cos(rad)) / (111320 * Math.cos((d.lat * Math.PI) / 180));
      const dLat = (-dMeters * Math.sin(rad)) / 110540;
      const a = this.map.project([d.lng, d.lat]);
      const b = this.map.project([d.lng + dLng, d.lat + dLat]);
      const k = Math.hypot(b.x - a.x, b.y - a.y) / 200;
      return k > 0.02 ? Math.min(4, 1 / k) : 1;
    };
    const waterH = (d: GaugeDatum) => Math.max(0.15, Math.min(FRAME_FT, d.level + PEDESTAL_FT)) * scale;
    const over = (d: GaugeDatum) => d.minor !== null && d.level > d.minor;
    const waterRgb = (d: GaugeDatum) => (over(d) ? CORAL_RGB : WATER_RGB);
    const trigger = data.map((d) => d.level.toFixed(2)).join();
    const viewKey = [scale, this.exaggeration, this.threeD, this.map.getBearing().toFixed(1)];

    const ticks: Tick[] = [];
    for (const g of data) {
      for (let f = 1 - PEDESTAL_FT; f <= FRAME_FT - PEDESTAL_FT; f++) if (f !== 0) ticks.push({ g, ft: f, kind: "foot" });
      ticks.push({ g, ft: 0, kind: "mhhw" });
      if (g.minor !== null && g.minor > 0 && g.minor < FRAME_FT - PEDESTAL_FT) ticks.push({ g, ft: g.minor, kind: "minor" });
    }
    const flooded = data.filter((d) => d.level > 0.02);

    this.overlay.setProps({
      layers: [
        new ColumnLayer<GaugeDatum>({
          id: "gauge-water",
          data,
          diskResolution: 20,
          radius,
          extruded: true,
          pickable: true,
          autoHighlight: true,
          highlightColor: [255, 255, 255, 60],
          onClick: (info) => {
            if (info.object) this.opts.onPickGauge?.(info.object.id);
          },
          getPosition: (d) => [d.lng, d.lat, base(d)],
          getElevation: waterH,
          getFillColor: (d) => [...waterRgb(d), alpha],
          material: { ambient: 0.75, diffuse: 0.45, shininess: 12, specularColor: [40, 60, 70] },
          updateTriggers: { getElevation: [trigger, scale], getFillColor: [trigger, alpha], getPosition: viewKey },
        }),
        ...(["foot", "mhhw", "minor"] as const).map(
          (kind) =>
            new ColumnLayer<Tick>({
              id: `gauge-ticks-${kind}`,
              data: ticks.filter((t) => t.kind === kind),
              diskResolution: 20,
              radius: (kind === "mhhw" ? 1.9 : kind === "minor" ? 1.65 : 1.35) * radius,
              extruded: true,
              material: false,
              getPosition: (t) => [t.g.lng, t.g.lat, base(t.g) + (t.ft + PEDESTAL_FT) * scale],
              getElevation: () => (kind === "foot" ? 0.07 : 0.14) * scale,
              getFillColor: kind === "minor" ? [CORAL_RGB[0], CORAL_RGB[1], CORAL_RGB[2], alpha] : [INK_RGB[0], INK_RGB[1], INK_RGB[2], kind === "mhhw" ? alpha : Math.round(alpha * 0.45)],
              updateTriggers: { getPosition: viewKey, getElevation: [scale] },
            }),
        ),
        new ColumnLayer<GaugeDatum>({
          id: "gauge-board",
          data,
          diskResolution: 20,
          radius: radius * 1.3,
          extruded: true,
          getPosition: (d) => [d.lng, d.lat, base(d)],
          getElevation: () => FRAME_FT * scale,
          getFillColor: [248, 250, 251, Math.round(alpha * 0.32)],
          material: false,
          pickable: false,
          // The board is see-through, so it must not hide the water column inside it.
          parameters: { depthWriteEnabled: false },
          updateTriggers: { getElevation: [scale], getPosition: viewKey },
        }),
        new ColumnLayer<GaugeDatum>({
          id: "gauge-ledge",
          data,
          diskResolution: 20,
          radius: radius * 1.15,
          extruded: true,
          material: false,
          getPosition: (d) => [...beside(d), mhhwZ(d) - 0.14 * scale],
          getElevation: () => 0.14 * scale,
          getFillColor: [INK_RGB[0], INK_RGB[1], INK_RGB[2], alpha],
          updateTriggers: { getPosition: viewKey, getElevation: [scale] },
        }),
        new IconLayer<GaugeDatum>({
          id: "gauge-person",
          data,
          billboard: true,
          sizeUnits: "meters",
          getIcon: () => PERSON_ICON,
          getPosition: (d) => [...beside(d), mhhwZ(d)],
          getSize: () => PERSON_FT * scale,
          getColor: [INK_RGB[0], INK_RGB[1], INK_RGB[2], Math.round(alpha * 0.9)],
          updateTriggers: { getPosition: viewKey, getSize: [scale] },
        }),
        // Water over the high-tide line rises around the person, so its depth reads on a body.
        new ColumnLayer<GaugeDatum>({
          id: "gauge-person-water",
          data: flooded,
          diskResolution: 24,
          radius: radius * 1.05,
          extruded: true,
          material: false,
          getPosition: (d) => [...beside(d), mhhwZ(d)],
          getElevation: (d) => Math.min(FRAME_FT - PEDESTAL_FT, d.level) * scale,
          getFillColor: (d) => [...waterRgb(d), Math.round(alpha * 0.55)],
          parameters: { depthWriteEnabled: false },
          updateTriggers: { getPosition: viewKey, getElevation: [trigger, scale], getFillColor: [trigger, alpha] },
        }),
        new TextLayer<GaugeDatum>({
          id: "gauge-label",
          data,
          characterSet: "auto",
          fontFamily: this.monoFamily,
          fontWeight: 500,
          getPosition: (d) => [d.lng, d.lat, base(d) + FRAME_FT * scale],
          getText: (d) => `${d.name}\n${vsHighTide(d.level)}${over(d) ? ", flooding" : ""}`,
          fontSettings: { sdf: true, fontSize: 64, buffer: 6, radius: 12 },
          lineHeight: 1.25,
          getSize: (d) => (this.opts.phone ? 10.5 : 11.5) * labelScale(d),
          getColor: (d) => (over(d) ? [169, 63, 37, 255] : [INK_RGB[0], INK_RGB[1], INK_RGB[2], 255]),
          getTextAnchor: "middle",
          getAlignmentBaseline: "bottom",
          getPixelOffset: (d) => [0, -5 * labelScale(d)],
          background: true,
          getBackgroundColor: [248, 250, 251, 235],
          getBorderColor: (d) => (d.selected ? [INK_RGB[0], INK_RGB[1], INK_RGB[2], 255] : [207, 219, 225, 255]),
          getBorderWidth: 1,
          backgroundPadding: [5, 2, 5, 2],
          updateTriggers: { getSize: [this.map.getZoom(), this.map.getPitch(), this.map.getBearing(), lat], getPixelOffset: [this.map.getZoom(), this.map.getPitch()], getText: [trigger], getColor: [trigger], getBorderColor: [data.map((d) => d.selected).join()], getPosition: viewKey },
        }),
      ],
    });
  }

  // Callouts --------------------------------------------------------------

  setCallouts(items: CalloutItem[]) {
    this.callouts = items;
    const keep = new Set(items.map((i) => i.id));
    for (const [id, m] of this.markers) {
      if (!keep.has(id)) {
        m.marker.remove();
        this.markers.delete(id);
      }
    }
    for (const item of items) {
      const hit = this.markers.get(item.id);
      if (hit) {
        hit.item = item;
        hit.el.querySelector("strong")!.textContent = item.title;
        hit.el.querySelector(".num")!.textContent = item.detail;
        continue;
      }
      const el = document.createElement("div");
      el.className = "callout";
      el.dataset.kind = item.kind;
      const card = document.createElement(item.href ? "a" : "div");
      card.className = "callout-card";
      if (item.href) (card as HTMLAnchorElement).href = item.href;
      const title = document.createElement("strong");
      title.textContent = item.title;
      const detail = document.createElement("span");
      detail.className = "num";
      detail.textContent = item.detail;
      card.append(title, detail);
      const leader = document.createElement("div");
      leader.className = "callout-leader";
      const dot = document.createElement("div");
      dot.className = "callout-dot";
      el.append(card, leader, dot);
      const marker = new maplibregl.Marker({ element: el, anchor: "bottom" }).setLngLat([item.lng, item.lat]).addTo(this.map);
      this.markers.set(item.id, { marker, el, item });
    }
    this.scheduleCallouts();
  }

  private scheduleCallouts() {
    if (this.calloutRaf || this.destroyed || !this.revealed) return;
    this.calloutRaf = requestAnimationFrame(() => {
      this.calloutRaf = 0;
      this.layoutCallouts();
    });
  }

  /** Greedy placement by priority. A card that would overlap a placed card, or leave the map, hides. */
  private layoutCallouts() {
    const canvas = this.map.getCanvas();
    // Panels over the map count as placed boxes, so a card never slides underneath one.
    const box = canvas.getBoundingClientRect();
    const placed: { x0: number; y0: number; x1: number; y1: number }[] = [...document.querySelectorAll("[data-map-obstacle]")].map((el) => {
      const r = el.getBoundingClientRect();
      return { x0: r.left - box.left, y0: r.top - box.top, x1: r.right - box.left, y1: r.bottom - box.top };
    });
    const W = canvas.clientWidth;
    const H = canvas.clientHeight;
    const pad = { left: 0, right: 0, top: 0, bottom: 0, ...this.map.getPadding() };
    const spotsOn = this.layers.spots.on;
    const opacity = this.layers.spots.opacity;
    const horizon = this.map.getPitch() > 40 ? H * 0.2 : 0;
    const ordered = [...this.markers.values()].sort((a, b) => a.item.priority - b.item.priority);
    for (const { el, item } of ordered) {
      const p = this.map.project([item.lng, item.lat]);
      const w = 176;
      const h = 76;
      // The king tide card hangs to the right of its leader, clear of the gauge column.
      const side = p.x + w > W - pad.right ? "left" : "right";
      el.dataset.side = side;
      const left = item.kind === "king" ? (side === "right" ? p.x - 4 : p.x - w + 4) : p.x - w / 2;
      const r = { x0: left - 3, y0: p.y - h - 3, x1: left + w + 3, y1: p.y + 3 };
      const visible = (spotsOn || item.kind === "king") && p.x > pad.left + 4 && p.x < W - pad.right - 4 && p.y > Math.max(pad.top + h, horizon) && p.y < H - pad.bottom;
      const free = visible && !placed.some((o) => r.x0 < o.x1 && r.x1 > o.x0 && r.y0 < o.y1 && r.y1 > o.y0);
      el.dataset.hidden = free ? "false" : "true";
      el.style.opacity = String(opacity);
      if (free) placed.push(r);
    }
  }

  setPadding(padding: EngineOptions["padding"]) {
    this.map.setPadding(padding);
  }

  resize() {
    this.map.resize();
  }

  destroy() {
    this.destroyed = true;
    clearTimeout(this.revealTimer);
    cancelAnimationFrame(this.waterRaf);
    cancelAnimationFrame(this.calloutRaf);
    for (const { marker } of this.markers.values()) marker.remove();
    this.markers.clear();
    this.overlay?.finalize();
    this.map.remove();
  }
}
