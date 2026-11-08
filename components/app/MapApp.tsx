"use client";

import dynamic from "next/dynamic";
import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fmtMonthDay, fmtTime, ft as fmtFt, vsHighTide } from "@/lib/format";
import { futureTideEquivalent, kingTideSentence } from "@/lib/metrics/king-tides";
import { POSTER_DESKTOP, POSTER_PHONE } from "@/lib/poster";
import { DEFAULT_STATION_ID, DEFAULT_VIEW, PHONE_VIEW } from "@/lib/site";
import { addDays, DAY, dayStart, pacificDay } from "@/lib/time";
import type { MapOverview, MapPlace, MapSpot, MapStation } from "@/lib/types";
import { Footer } from "../Footer";
import type { CalloutItem, GaugeDatum, ViewState } from "../map/engine";
import { DEFAULT_LAYERS, type LayerId, type LayerSettings } from "../map/layers";
import type { FlyTarget } from "../map/MapStage";
import { Playhead, prefersReducedMotion, usePlayback, type Speed } from "../map/playhead";
import { Scrubber, type ScrubberEvent } from "../map/Scrubber";
import { levelAt, STEP_MS, useFrames } from "../map/useFrames";
import { readUrlState, writeUrlState } from "../map/url-state";
import { WaterSlider } from "../map/WaterSlider";
import { MiniCharts } from "./BottomPanel";
import { BottomSheet, PEEK_HEIGHT, type Snap } from "./BottomSheet";
import { LayerRows } from "./LayerRows";
import { NotesTab } from "./NotesTab";
import { Sidebar, Tabs, type TabId } from "./Sidebar";
import { StationSummary } from "./StationSummary";
import { DateRange, TopBar } from "./TopBar";
import { GoSeeIt } from "./GoSeeIt";

const MapStage = dynamic(() => import("../map/MapStage"), { ssr: false });

const SIDEBAR_W = 340;
const BOTTOM_H = 214;
const FOOTER_H = 32;
const MAP_DELAY_PHONE_MS = 3500;
const MAP_DELAY_DESKTOP_MS = 500;

interface Props {
  overview: MapOverview;
  stations: MapStation[];
  spots: MapSpot[];
  places: MapPlace[];
  initialNow: number;
}

function hasWebgl2(): boolean {
  try {
    const gl = document.createElement("canvas").getContext("webgl2");
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
    return !!gl;
  } catch {
    return false;
  }
}

export function MapApp({ overview, stations, spots, places, initialNow }: Props) {
  const [stationId, setStationId] = useState(DEFAULT_STATION_ID);
  const [ft, setFt] = useState(0);
  const [layers, setLayers] = useState<LayerSettings>(DEFAULT_LAYERS);
  const [followTide, setFollowTide] = useState(true);
  const [exaggeration, setExaggeration] = useState(3);
  const [is3D, setIs3D] = useState(true);
  const [compare, setCompare] = useState(false);
  const [from, setFrom] = useState(() => pacificDay(initialNow - 3 * DAY));
  const [tab, setTab] = useState<TabId>("visit");
  const [snap, setSnap] = useState<Snap>(0);
  const [sheetH, setSheetH] = useState(PEEK_HEIGHT);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<Speed>(1);
  const [fly, setFly] = useState<FlyTarget | null>(null);
  const [boot, setBoot] = useState<{ view: ViewState; phone: boolean; webgl2: boolean } | null>(null);
  const [now, setNow] = useState(initialNow);
  const [touched, setTouched] = useState(false);
  const [sliderTip, setSliderTip] = useState(false);
  const [layout, setLayout] = useState<"pending" | "phone" | "desktop">("pending");
  const [tide, setTide] = useState({ effective: 0, level: 0, add: 0 });
  const viewRef = useRef<ViewState | null>(null);

  const playhead = useMemo(() => new Playhead(), []);
  const stationIndex = useMemo(() => new Map(stations.map((s) => [s.id, s])), [stations]);
  const stationById = useCallback((id: string | null) => (id ? stationIndex.get(id) : undefined), [stationIndex]);
  // Before the map boots, only the selected gauge loads. It feeds the charts and the scrubber.
  const frameStations = useMemo(() => (boot ? stations : stations.filter((s) => s.id === stationId)), [boot, stations, stationId]);
  const frames = useFrames(from, frameStations, stations.length);
  const station = stationById(stationId) ?? stations[0];
  const stationOverview = overview.stations.find((s) => s.stationId === station.id) ?? null;
  const next = stationOverview?.next ?? null;
  const placeMap = useMemo(() => {
    const out = new Map<number, MapPlace[]>();
    for (const p of places) if (p.firstFloodFt !== null) out.set(p.firstFloodFt, [...(out.get(p.firstFloodFt) ?? []), p]);
    return out;
  }, [places]);

  usePlayback(playhead, frames.count, playing, speed, () => setPlaying(false));

  // Phones have little room beside the slider, so the tip clears itself after a few seconds there.
  useEffect(() => {
    if (!sliderTip || layout !== "phone") return;
    const t = setTimeout(() => setSliderTip(false), 6000);
    return () => clearTimeout(t);
  }, [sliderTip, ft, layout]);

  useEffect(() => {
    const query = window.matchMedia("(min-width: 1024px)");
    const apply = () => startTransition(() => setLayout(query.matches ? "desktop" : "phone"));
    apply();
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, []);

  // Boot: read the URL once the browser is available, then load the map when the page is idle.
  useEffect(() => {
    const u = readUrlState();
    const phone = window.innerWidth < 768;
    const clock = Date.now();
    const base = phone ? PHONE_VIEW : DEFAULT_VIEW;
    const view: ViewState = {
      lat: u.view.lat ?? base.lat,
      lng: u.view.lng ?? base.lng,
      zoom: u.view.zoom ?? base.zoom,
      pitch: u.view.pitch ?? base.pitch,
      bearing: u.view.bearing ?? base.bearing,
    };
    const t = u.t ?? clock;
    const fromDay = u.t ? pacificDay(t - 3 * DAY) : pacificDay(clock - 3 * DAY);
    /* eslint-disable react-hooks/set-state-in-effect -- browser-only values, read once after hydration */
    setNow(clock);
    setFrom(fromDay);
    playhead.set(Math.max(0, (t - dayStart(fromDay)) / STEP_MS));
    if (u.station && stationById(u.station)) setStationId(u.station);
    if (u.ft !== null) setFt(u.ft);
    if (phone) setExaggeration(2);
    if (u.compare) setCompare(true);
    if (u.t || u.ft !== null || u.view.lat !== undefined) setTouched(true);
    /* eslint-enable react-hooks/set-state-in-effect */
    viewRef.current = view;
    // The map waits for the first interaction, or a short pause after load, so reading comes first.
    // The poster holds its place until then, and nothing shifts when the canvas arrives.
    let started = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const start = () => {
      if (started) return;
      started = true;
      // Creating a GPU context is slow, so this check waits until the map is about to need the answer.
      const webgl2 = hasWebgl2();
      if (!webgl2) setIs3D(false);
      setBoot({ view, phone, webgl2 });
    };
    const events = ["pointerdown", "keydown", "wheel", "touchstart"] as const;
    const onFirst = () => start();
    for (const ev of events) window.addEventListener(ev, onFirst, { once: true, passive: true });
    const arm = () => {
      timer = setTimeout(start, phone ? MAP_DELAY_PHONE_MS : MAP_DELAY_DESKTOP_MS);
    };
    if (document.readyState === "complete") arm();
    else window.addEventListener("load", arm, { once: true });
    if (u.play && !prefersReducedMotion()) setPlaying(true);
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener("load", arm);
      for (const ev of events) window.removeEventListener(ev, onFirst);
    };
    // Runs once. The station list comes from the server and never changes on this page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playhead]);

  const selectedLevel = useCallback(() => {
    const l = levelAt(frames, stationId, playhead.getPos());
    return l ? l.value - (stationById(stationId)?.datums.mhhw ?? 0) : null;
  }, [frames, stationId, playhead, stationById]);

  // The water layer follows the tide: water above MHHW at the selected gauge raises the layer. The map
  // draws the exact level, and the panels name the nearest whole foot.
  const followRef = useRef({ ft, followTide, selectedLevel });
  useEffect(() => {
    followRef.current = { ft, followTide, selectedLevel };
  });
  useEffect(() => {
    const update = () => {
      const { ft: f, followTide: follow, selectedLevel: read } = followRef.current;
      const above = read();
      const add = follow && above !== null ? Math.max(0, above) : 0;
      const level = Math.max(0, Math.min(10, Math.round((f + add) * 20) / 20));
      const effective = Math.round(level);
      const roundedAdd = Math.round(add * 10) / 10;
      setTide((prev) => (prev.level === level && prev.add === roundedAdd ? prev : { effective, level, add: roundedAdd }));
    };
    update();
    return playhead.subscribe(update);
  }, [playhead, ft, followTide, selectedLevel]);

  // Address bar. Stays clean until the visitor changes something, then every view is shareable.
  const writeUrl = useCallback(() => {
    writeUrlState({ t: dayStart(from) + Math.round(playhead.getPos()) * STEP_MS, view: viewRef.current, station: stationId, ft, compare });
  }, [from, playhead, stationId, ft, compare]);
  const touchedRef = useRef(touched);
  const writeUrlRef = useRef(writeUrl);
  useEffect(() => {
    touchedRef.current = touched;
    writeUrlRef.current = writeUrl;
  });
  useEffect(() => {
    if (touched) writeUrl();
  }, [touched, writeUrl]);
  useEffect(
    () =>
      playhead.subscribe(() => {
        if (touchedRef.current) writeUrlRef.current();
      }),
    [playhead],
  );

  const getGauges = useCallback((): GaugeDatum[] => {
    const out: GaugeDatum[] = [];
    for (const s of stations) {
      const l = levelAt(frames, s.id, playhead.getPos());
      if (!l) continue;
      out.push({ id: s.id, name: s.name, lng: s.lng, lat: s.lat, level: l.value - s.datums.mhhw + ft, minor: s.thresholds.minor, selected: s.id === stationId });
    }
    return out;
  }, [stations, frames, playhead, ft, stationId]);

  const gaugesKey = useMemo(() => ({ frames, stationId, ft }), [frames, stationId, ft]);

  const callouts = useMemo<CalloutItem[]>(() => {
    const items: CalloutItem[] = [];
    const short = (t: number, h: number) => `${fmtMonthDay(t)}, ${fmtTime(t)}, ${h.toFixed(1)} ft`;
    if (next) {
      items.push({ id: "king", lng: station.lng, lat: station.lat, title: `Next king tide, ${station.name}`, detail: short(next.t, next.height), priority: 0, kind: "king", href: `/stations/${station.slug}` });
    }
    spots.forEach((s, i) => {
      const o = overview.stations.find((x) => x.stationId === s.nearestStationId)?.next;
      items.push({ id: s.slug, lng: s.lng, lat: s.lat, title: s.name, detail: o ? short(o.t, o.height) : "Shoreline spot", priority: i + 1, kind: "spot", href: `/spots/${s.slug}` });
    });
    return items;
  }, [next, station, spots, overview]);

  const events = useMemo<ScrubberEvent[]>(() => {
    const t0 = frames.t0;
    const out: ScrubberEvent[] = [];
    for (const [t, height] of stationOverview?.kings ?? []) {
      const i = Math.round((t - t0) / STEP_MS);
      if (i >= 0 && i < frames.count) out.push({ index: i, kind: "king", label: `King tide, ${height.toFixed(1)} ft` });
    }
    const minor = station.thresholds.minor;
    const series = frames.predicted.get(station.id);
    if (minor !== null && series) {
      const bar = station.datums.mhhw + minor - ft;
      for (let i = 1; i < series.length; i++) {
        if (series[i - 1] <= bar && series[i] > bar) out.push({ index: i, kind: "threshold", label: `Crosses the minor threshold with ${ft} ft added` });
      }
    }
    return out;
  }, [frames, stationOverview, station, ft]);

  const onScrub = useCallback(() => setTouched(true), []);

  const goTo = useCallback(
    (t: number) => {
      const day = pacificDay(t - 3 * DAY);
      setFrom(day);
      playhead.set(Math.max(0, (t - dayStart(day)) / STEP_MS));
      setPlaying(false);
      setTouched(true);
    },
    [playhead],
  );

  const shiftWeek = useCallback(
    (days: number) => {
      setFrom((d) => {
        const nextFrom = addDays(d, days);
        const today = pacificDay(Date.now());
        if (nextFrom < addDays(today, -45) || nextFrom > addDays(today, 358)) return d;
        return nextFrom;
      });
      setTouched(true);
    },
    [],
  );

  const onStation = useCallback(
    (id: string) => {
      const s = stationById(id);
      if (!s) return;
      setStationId(id);
      setFly((f) => ({ lng: s.lng, lat: s.lat, facing: s.facing, nonce: (f?.nonce ?? 0) + 1 }));
      setTouched(true);
    },
    [stationById],
  );

  const onSpot = useCallback(
    (slug: string) => {
      const s = spots.find((x) => x.slug === slug);
      if (!s) return;
      setStationId(s.nearestStationId);
      setFly((f) => ({ lng: s.lng, lat: s.lat, facing: s.facing, zoom: 14.2, nonce: (f?.nonce ?? 0) + 1 }));
      setTouched(true);
    },
    [spots],
  );

  const onLayer = useCallback((id: LayerId, v: { on: boolean; opacity: number }) => {
    setLayers((prev) => ({ ...prev, [id]: v }));
  }, []);

  const onView = useCallback((v: ViewState) => {
    viewRef.current = v;
    if (touchedRef.current) writeUrlRef.current();
  }, []);

  const phone = boot?.phone ?? false;
  const padding = useMemo(
    () => (phone ? { top: 92, right: 0, bottom: PEEK_HEIGHT + 82, left: 0 } : { top: 48, right: SIDEBAR_W, bottom: BOTTOM_H + FOOTER_H, left: 0 }),
    [phone],
  );

  const predicted = frames.predicted.get(station.id) ?? null;
  const observedSeries = frames.observed.get(station.id);
  const thresholdLabel = stationOverview?.thresholdKind === "action" ? "action level" : "minor threshold";

  const readout = useCallback(
    (i: number) => {
      const l = levelAt(frames, stationId, i);
      if (!l) return "";
      const s = stationById(stationId);
      const above = l.value - (s?.datums.mhhw ?? 0);
      return `${s?.name} ${fmtFt(l.value)} MLLW, ${vsHighTide(above)}, ${l.kind}`;
    },
    [frames, stationId, stationById],
  );

  const ariaLabel = `3D map of San Francisco Bay with NOAA sea level rise shown at ${tide.effective} ft and ${stations.length} tide gauges`;

  const summaryLine = next ? kingTideSentence(next, now) : "NOAA predictions are unavailable right now. The map still loads.";

  const scrubber = (extra: string) => (
    <Scrubber
      playhead={playhead}
      t0={frames.t0}
      stepMs={STEP_MS}
      count={frames.count}
      series={predicted}
      playing={playing}
      onPlaying={(p) => {
        setPlaying(p);
        setTouched(true);
      }}
      speed={speed}
      onSpeed={setSpeed}
      nowIndex={Math.round((now - frames.t0) / STEP_MS)}
      loaded={frames.loaded}
      events={events}
      readout={readout}
      onScrub={onScrub}
      className={extra}
    />
  );

  const charts = (layoutClass: string, chartHeight: number) => (
    <MiniCharts
      station={station}
      t0={frames.t0}
      stepMs={STEP_MS}
      count={frames.count}
      predicted={predicted}
      observed={observedSeries?.values ?? null}
      residual={observedSeries?.residual ?? null}
      surge={observedSeries?.surge ?? null}
      observedAsOf={observedSeries?.asOf ?? null}
      king={next}
      daysOver={stationOverview?.daysOver ?? []}
      thresholdLabel={thresholdLabel}
      overviewAsOf={overview.asOf}
      playhead={playhead}
      chartHeight={chartHeight}
      layoutClass={layoutClass}
    />
  );

  const panelBody = (t: TabId, mobile: boolean) => {
    if (t === "layers") return <LayerRows layers={layers} onChange={onLayer} followTide={followTide} onFollowTide={setFollowTide} />;
    if (t === "notes") return <NotesTab />;
    if (t === "visit") return <GoSeeIt station={station} next={next} spots={spots} onSpot={onSpot} onShowTide={goTo} />;
    return (
      <div className="space-y-4">
        <StationSummary station={station} overview={stationOverview} now={now} asOf={overview.asOf} surge={observedSeries?.surge ?? null} surgeAsOf={observedSeries?.asOf ?? null} />
        {mobile ? charts("space-y-4 border-t border-line pt-3", 110) : null}
      </div>
    );
  };

  return (
    <div data-map-root className="relative h-dvh w-full overflow-hidden bg-bg" style={{ "--sheet-h": `${sheetH}px` } as React.CSSProperties}>
      {/* Painted in the first frame. CSS picks the crop so nothing shifts when the map arrives. */}
      <div className="absolute inset-0 lg:hidden" style={{ backgroundImage: POSTER_PHONE, backgroundSize: "cover", backgroundPosition: "center" }} aria-hidden />
      <div className="absolute inset-0 hidden lg:block" style={{ backgroundImage: POSTER_DESKTOP, backgroundSize: "cover", backgroundPosition: "center" }} aria-hidden />

      <section aria-label={ariaLabel} className="absolute inset-0">
        {boot ? (
          <MapStage
            initialView={boot.view}
            phone={boot.phone}
            webgl2={boot.webgl2}
            layers={layers}
            waterFt={compare ? Math.max(ft, tide.level) : tide.level}
            compare={compare}
            compareFt={Math.max(ft, tide.effective)}
            exaggeration={exaggeration}
            onExaggeration={setExaggeration}
            is3D={is3D}
            on3D={setIs3D}
            playhead={playhead}
            getGauges={getGauges}
            gaugesKey={gaugesKey}
            callouts={callouts}
            fly={fly}
            ariaLabel={ariaLabel}
            padding={padding}
            controlsClassName="pointer-events-none absolute right-2 top-[106px] z-10 lg:top-auto lg:bottom-[calc(214px+var(--footer-h)+34px)] lg:right-[calc(340px+10px)]"
            onView={onView}
            onPickGauge={onStation}
            onStage={() => undefined}
          />
        ) : null}
        <p className="sr-only" aria-live="polite">
          {`Water layer at ${tide.effective} ft of sea level rise. Selected gauge ${station.name}. ${summaryLine}`}
        </p>
      </section>

      <TopBar
        stations={stations}
        spots={spots}
        stationId={stationId}
        onStation={onStation}
        onSpot={onSpot}
        from={from}
        onShiftWeek={shiftWeek}
        onNow={() => goTo(Date.now())}
        onNextKing={next ? () => goTo(next.t) : null}
      />

      <div className="pointer-events-none absolute left-2 right-2 top-[58px] z-10 lg:left-3 lg:right-auto lg:top-[58px] lg:w-[318px]">
        <div data-map-obstacle className="panel pointer-events-auto px-2.5 py-1.5 lg:px-3 lg:py-2.5">
          <h1 className="text-[16px] lg:text-[20px]">SF Bay king tides and sea level rise</h1>
          <p className="mt-1 hidden text-[14px] leading-snug lg:block" data-testid="summary-line">
            {summaryLine}
          </p>
        </div>
      </div>

      <div data-map-obstacle className="absolute left-2 top-[106px] z-10 lg:left-3 lg:top-[192px]" data-testid="water-slider">
        <WaterSlider
          value={ft}
          onChange={(v) => {
            setFt(v);
            setTouched(true);
            setSliderTip(true);
          }}
          showTip={sliderTip}
          effective={tide.effective}
          tideAddFt={tide.add}
          kingEq={next ? futureTideEquivalent(next.aboveMhhw) : null}
          kingLabel={next ? `Next king tide, ${futureTideEquivalent(next.aboveMhhw).toFixed(1)} ft above MHHW` : ""}
          placesByFt={placeMap}
          compare={compare}
          onCompare={(on) => {
            setCompare(on);
            setTouched(true);
            if (on && ft === 0) setFt(3);
          }}
          canCompare={boot?.webgl2 ?? true}
        />
      </div>

      {boot && !boot.webgl2 ? (
        <p className="panel absolute right-2 top-[106px] z-10 max-w-[230px] px-2.5 py-1.5 text-[13px] lg:right-[calc(340px+12px)] lg:top-[58px]" data-testid="webgl-note">
          This browser has no WebGL2, so the map is flat 2D with the same layers.
        </p>
      ) : null}

      {/* Each device mounts only its own panels, right after hydration. The boxes are fixed-size, so nothing shifts. */}
      <Sidebar tab={tab} onTab={setTab} className="absolute bottom-[var(--footer-h)] right-0 top-12 hidden w-[340px] lg:flex">
        {layout === "desktop" ? panelBody(tab, false) : <div className="skeleton h-64 w-full" />}
      </Sidebar>

      <div className="absolute bottom-[var(--footer-h)] left-0 right-[340px] z-20 hidden h-[214px] flex-col gap-1.5 border-t border-line bg-panel px-3 py-2 lg:flex" data-testid="bottom-panel">
        {layout === "desktop" ? (
          <>
            {scrubber("shrink-0")}
            {charts("grid min-h-0 flex-1 grid-cols-[1.45fr_1.1fr_0.9fr] gap-4", 104)}
          </>
        ) : (
          <>
            <div className="skeleton h-[64px] w-full shrink-0" />
            <div className="skeleton min-h-0 w-full flex-1" />
          </>
        )}
      </div>

      <Footer className="absolute inset-x-0 bottom-0 z-20 hidden h-[var(--footer-h)] lg:flex" />

      {/* Phone layout: the scrubber rides above the sheet. */}
      <div className="absolute inset-x-0 z-20 border-t border-line bg-panel px-2 py-1.5 lg:hidden" style={{ bottom: sheetH }} data-testid="mobile-scrubber">
        {layout === "phone" ? scrubber("") : <div className="skeleton h-[64px] w-full" />}
      </div>
      <BottomSheet
        snap={snap}
        onSnap={setSnap}
        onHeight={setSheetH}
        className="lg:hidden"
        peek={
          <div className="pb-2">
            {next ? (
              <p className="text-[15px] leading-snug">
                <span className="num font-medium">{fmtFt(next.height)}</span> at {station.name}, <span className="num">{fmtMonthDay(next.t)}, {fmtTime(next.t)}</span>. A normal high tide with <span className="num">{futureTideEquivalent(next.aboveMhhw).toFixed(1)} ft</span> of sea level rise.
              </p>
            ) : (
              <p className="text-[15px]">NOAA predictions are unavailable right now.</p>
            )}
          </div>
        }
      >
        {snap > 0 && layout === "phone" ? (
          <>
            <Tabs
              tab={tab}
              onTab={setTab}
              idPrefix="sheet"
            />
            <div id="sheet-panel" role="tabpanel" aria-labelledby={`sheet-tab-${tab}`} className="min-h-0 flex-1 overflow-y-auto">
              <div className="p-3">
                <div className="mb-3 lg:hidden">
                  <DateRange from={from} onShiftWeek={shiftWeek} onNow={() => goTo(Date.now())} onNextKing={next ? () => goTo(next.t) : null} />
                </div>
                {panelBody(tab, true)}
              </div>
              <Footer />
            </div>
          </>
        ) : null}
      </BottomSheet>
    </div>
  );
}
