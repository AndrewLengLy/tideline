"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { TideEngine, type CalloutItem, type GaugeDatum, type ViewState } from "./engine";
import type { LayerSettings } from "./layers";
import { MapControls } from "./MapControls";
import { prefersReducedMotion, type Playhead } from "./playhead";

export interface FlyTarget {
  lng: number;
  lat: number;
  facing: number;
  zoom?: number;
  nonce: number;
}

interface Props {
  initialView: ViewState;
  phone: boolean;
  webgl2: boolean;
  layers: LayerSettings;
  waterFt: number;
  /** Foot value shown on the moving side of compare mode. */
  compare: boolean;
  compareFt: number;
  exaggeration: number;
  is3D: boolean;
  on3D: (on: boolean) => void;
  playhead: Playhead;
  getGauges: () => GaugeDatum[];
  gaugesKey: unknown;
  callouts: CalloutItem[];
  fly: FlyTarget | null;
  ariaLabel: string;
  padding: { top: number; right: number; bottom: number; left: number };
  controlsClassName: string;
  onView: (v: ViewState) => void;
  onPickGauge: (id: string) => void;
  onPickPoint: (p: { lng: number; lat: number }) => void;
  pin: { lng: number; lat: number } | null;
  onStage: (stage: "base" | "full") => void;
}

export default function MapStage(props: Props) {
  const { initialView, phone, webgl2, layers, waterFt, compare, compareFt, exaggeration, is3D, playhead, gaugesKey, callouts, fly, ariaLabel, padding } = props;
  const primaryEl = useRef<HTMLDivElement>(null);
  const compareEl = useRef<HTMLDivElement>(null);
  const engine = useRef<TideEngine | null>(null);
  const secondary = useRef<TideEngine | null>(null);
  const [bearing, setBearing] = useState(initialView.bearing);
  const [fullscreen, setFullscreen] = useState(false);
  const [swipe, setSwipe] = useState(50);
  const latest = useRef(props);
  useEffect(() => {
    latest.current = props;
  });

  // Create the primary map once. Everything after this goes through setters.
  useEffect(() => {
    if (!primaryEl.current) return;
    const e = new TideEngine({
      container: primaryEl.current,
      view: initialView,
      phone,
      webgl2,
      ariaLabel,
      reducedMotion: prefersReducedMotion(),
      padding,
      onView: (v) => latest.current.onView(v),
      onLive: (v) => setBearing(v.bearing),
      onPickGauge: (id) => latest.current.onPickGauge(id),
      onPickPoint: (p) => latest.current.onPickPoint(p),
      onStage: (s) => latest.current.onStage(s),
    });
    engine.current = e;
    e.setLayers(latest.current.layers);
    e.setExaggeration(latest.current.exaggeration);
    e.setWater(latest.current.waterFt);
    e.setGauges(latest.current.getGauges());
    e.setCallouts(latest.current.callouts);
    e.setPin(latest.current.pin);
    (window as unknown as { __tideEngine?: TideEngine }).__tideEngine = e;
    return () => {
      e.destroy();
      engine.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- created once, later changes flow through the setters below
  }, []);

  useEffect(() => engine.current?.setLayers(layers), [layers]);
  useEffect(() => engine.current?.setWater(waterFt), [waterFt]);
  useEffect(() => engine.current?.setExaggeration(exaggeration), [exaggeration]);
  useEffect(() => engine.current?.set3D(is3D), [is3D]);
  useEffect(() => engine.current?.setCallouts(callouts), [callouts]);
  useEffect(() => engine.current?.setPadding(padding), [padding]);
  useEffect(() => engine.current?.setPin(props.pin), [props.pin]);

  // Column heights follow the playhead without going through React state.
  useEffect(() => {
    const push = () => engine.current?.setGauges(latest.current.getGauges());
    push();
    return playhead.subscribe(push);
  }, [playhead, gaugesKey]);

  const flyNonce = fly?.nonce;
  useEffect(() => {
    if (fly) engine.current?.flyTo(fly.lng, fly.lat, fly.facing, fly.zoom);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one flight per nonce
  }, [flyNonce]);

  // Compare mode adds a second map above the first, clipped at the swipe line and locked to the same camera.
  useEffect(() => {
    if (!compare || !compareEl.current || !engine.current) return;
    const main = engine.current;
    const other = new TideEngine({
      container: compareEl.current,
      view: main.getView(),
      phone,
      webgl2,
      secondary: true,
      ariaLabel: "Comparison map at today's MHHW",
      reducedMotion: prefersReducedMotion(),
      padding: latest.current.padding,
    });
    secondary.current = other;
    other.setLayers({ ...latest.current.layers, confidence: { on: false, opacity: 0 } });
    other.setExaggeration(latest.current.exaggeration);
    other.setWater(0);
    let syncing = false;
    const fromMain = () => {
      if (syncing) return;
      syncing = true;
      other.jumpTo(main.getView());
      syncing = false;
    };
    const fromOther = () => {
      if (syncing) return;
      syncing = true;
      main.jumpTo(other.getView());
      syncing = false;
    };
    main.map.on("move", fromMain);
    other.map.on("move", fromOther);
    return () => {
      main.map.off("move", fromMain);
      other.map.off("move", fromOther);
      other.destroy();
      secondary.current = null;
    };
  }, [compare, phone, webgl2]);

  useEffect(() => secondary.current?.setLayers({ ...layers, confidence: { on: false, opacity: 0 } }), [layers]);
  useEffect(() => secondary.current?.setExaggeration(exaggeration), [exaggeration]);

  const onHandle = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!e.buttons && e.type !== "pointerdown") return;
    const box = e.currentTarget.parentElement?.getBoundingClientRect();
    if (!box) return;
    setSwipe(Math.max(4, Math.min(96, ((e.clientX - box.left) / box.width) * 100)));
    if (e.type === "pointerdown") e.currentTarget.setPointerCapture(e.pointerId);
  }, []);

  const toggleFullscreen = () => {
    const root = primaryEl.current?.closest("[data-map-root]");
    if (!document.fullscreenElement) root?.requestFullscreen?.();
    else document.exitFullscreen?.();
  };
  useEffect(() => {
    const on = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", on);
    return () => document.removeEventListener("fullscreenchange", on);
  }, []);

  return (
    <>
      {/* MapLibre sets position: relative on its container, so the sizing lives on a wrapper. */}
      <div className="absolute inset-0">
        <div ref={primaryEl} className="h-full w-full" data-testid="map-canvas" />
      </div>
      {compare ? (
        <>
          <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - swipe}% 0 0)` }}>
            <div ref={compareEl} className="h-full w-full" data-testid="compare-canvas" />
          </div>
          <div
            className="absolute inset-y-0 z-[5] flex w-11 -translate-x-1/2 cursor-ew-resize touch-none justify-center"
            style={{ left: `${swipe}%` }}
            onPointerDown={onHandle}
            onPointerMove={onHandle}
            role="slider"
            tabIndex={0}
            aria-label="Compare swipe position"
            aria-valuemin={4}
            aria-valuemax={96}
            aria-valuenow={Math.round(swipe)}
            onKeyDown={(e) => {
              if (e.key === "ArrowLeft") setSwipe((s) => Math.max(4, s - 2));
              if (e.key === "ArrowRight") setSwipe((s) => Math.min(96, s + 2));
            }}
          >
            <div className="h-full w-0.5 bg-ink" />
            <div className="panel num absolute top-1/2 flex -translate-y-1/2 whitespace-nowrap text-[12px]">
              <span className="border-r border-line px-2 py-1">Today, MHHW</span>
              <span className="px-2 py-1">+{compareFt} ft</span>
            </div>
          </div>
        </>
      ) : null}
      <div data-map-obstacle className={props.controlsClassName}>
        <MapControls
          is3D={is3D}
          on3D={props.on3D}
          bearing={bearing}
          onResetBearing={() => engine.current?.resetBearing()}
          onFullscreen={toggleFullscreen}
          isFullscreen={fullscreen}
          webgl2={webgl2}
        />
      </div>
    </>
  );
}
