"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  height: number;
  /** Width used for the server render, before the real width can be measured. */
  initialWidth?: number;
  label: string;
  className?: string;
  children: (size: { w: number; h: number }) => React.ReactNode;
}

/** A plain SVG sized in real pixels, so chart text stays the same size at every width. */
export function ChartFrame({ height, initialWidth = 360, label, className, children }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(initialWidth);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(120, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={ref} className={className} style={{ height }}>
      <svg width="100%" height={height} viewBox={`0 0 ${w} ${height}`} role="img" aria-label={label} className="block overflow-visible">
        {children({ w, h: height })}
      </svg>
    </div>
  );
}
