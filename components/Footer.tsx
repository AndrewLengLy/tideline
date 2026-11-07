import Link from "next/link";
import { AUTHOR_NAME, AUTHOR_URL, LINKS, REPO_URL, SAFETY_LINE } from "@/lib/site";

const CREDITS: [string, string][] = [
  ["NOAA CO-OPS", LINKS.coops],
  ["NOAA SLR Viewer", LINKS.slrViewer],
  ["USGS National Map imagery", LINKS.usgsImagery],
  ["AWS Terrain Tiles (Mapzen)", LINKS.awsTerrain],
  ["OpenFreeMap", LINKS.openFreeMap],
  ["OpenStreetMap", LINKS.osm],
];

const LINK = "underline decoration-line underline-offset-2 hover:text-link";

/** One row on desktop, stacked on mobile. */
export function Footer({ className = "" }: { className?: string }) {
  return (
    <footer className={`flex flex-col gap-2 border-t border-line bg-panel px-3 py-3 text-[13px] leading-snug text-muted lg:flex-row lg:items-center lg:justify-between lg:gap-4 lg:py-1 lg:text-[11px] ${className}`}>
      <p className="flex shrink-0 flex-wrap gap-x-3 gap-y-1">
        <span>
          Built by{" "}
          <a className={LINK} href={AUTHOR_URL}>
            {AUTHOR_NAME}
          </a>
        </span>
        <Link className={LINK} href="/methodology">
          Methodology
        </Link>
        <a className={LINK} href={REPO_URL}>
          GitHub repo
        </a>
      </p>
      <div className="flex flex-col gap-1 lg:flex-row lg:flex-wrap lg:items-center lg:justify-end lg:gap-x-3 lg:gap-y-0">
        <p className="flex flex-wrap gap-x-2.5 gap-y-1">
          {CREDITS.map(([name, href]) => (
            <a key={name} className={LINK} href={href}>
              {name}
            </a>
          ))}
        </p>
        <p className="text-ink">
          {SAFETY_LINE}{" "}
          <a className={LINK} href={LINKS.nws}>
            NWS Bay Area
          </a>
        </p>
      </div>
    </footer>
  );
}
