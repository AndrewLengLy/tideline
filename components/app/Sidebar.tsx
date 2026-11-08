"use client";

export type TabId = "visit" | "place" | "station" | "layers";

const TABS: { id: TabId; label: string }[] = [
  { id: "visit", label: "Go see it" },
  { id: "place", label: "Check a place" },
  { id: "station", label: "Gauge" },
  { id: "layers", label: "Layers" },
];

export function Tabs({ tab, onTab, idPrefix }: { tab: TabId; onTab: (t: TabId) => void; idPrefix: string }) {
  return (
    <div role="tablist" aria-label="Panel" className="flex shrink-0 border-b border-line">
      {TABS.map((t) => (
        <button
          key={t.id}
          id={`${idPrefix}-tab-${t.id}`}
          type="button"
          role="tab"
          aria-selected={tab === t.id}
          aria-controls={`${idPrefix}-panel`}
          onClick={() => onTab(t.id)}
          className={`h-11 flex-1 border-b-2 text-[14px] lg:h-10 ${tab === t.id ? "border-ink font-bold text-ink" : "border-transparent text-muted hover:text-ink"}`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

/** Right sidebar on desktop. Phones get the same content in the bottom sheet. */
export function Sidebar({ tab, onTab, children, className = "" }: { tab: TabId; onTab: (t: TabId) => void; children: React.ReactNode; className?: string }) {
  return (
    <aside className={`z-20 flex-col border-l border-line bg-panel ${className}`} aria-label="Map panels">
      <Tabs tab={tab} onTab={onTab} idPrefix="side" />
      <div id="side-panel" role="tabpanel" aria-labelledby={`side-tab-${tab}`} className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {children}
      </div>
    </aside>
  );
}
