export type LayerId = "terrain" | "imagery" | "slr" | "confidence" | "thresholds" | "buildings" | "spots";
export type LayerSettings = Record<LayerId, { on: boolean; opacity: number }>;

export const DEFAULT_LAYERS: LayerSettings = {
  terrain: { on: true, opacity: 0.45 },
  imagery: { on: true, opacity: 1 },
  slr: { on: true, opacity: 1 },
  confidence: { on: false, opacity: 0.7 },
  thresholds: { on: true, opacity: 1 },
  buildings: { on: true, opacity: 0.85 },
  spots: { on: true, opacity: 1 },
};
