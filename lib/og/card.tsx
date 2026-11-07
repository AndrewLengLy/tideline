import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_TYPE = "image/png";

const font = (file: string) => readFile(join(process.cwd(), "node_modules", file));

/** Shared 1200x630 card: the page's headline number, its unit, a context line, and the tool name. */
export async function ogCard({ number, unit, line, kicker }: { number: string; unit: string; line: string; kicker: string }) {
  const [display, mono] = await Promise.all([font("@fontsource/schibsted-grotesk/files/schibsted-grotesk-latin-700-normal.woff"), font("@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-500-normal.woff")]);
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#eef3f5", color: "#0d2230", padding: 64, fontFamily: "Schibsted Grotesk" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <svg width="48" height="48" viewBox="0 0 32 32">
            <rect width="32" height="32" rx="6" fill="#0d2230" />
            <path d="M3 19c4-5 7-5 10 0s6 5 9 0 5-4 7-2v11H3z" fill="#0077b6" />
          </svg>
          <span style={{ fontSize: 44 }}>Tideline</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ fontSize: 34 }}>{kicker}</span>
          <div style={{ display: "flex", alignItems: "baseline", gap: 22, marginTop: 8 }}>
            <span style={{ fontFamily: "IBM Plex Mono", fontSize: 150, color: "#0077b6", lineHeight: 1.05 }}>{number}</span>
            <span style={{ fontFamily: "IBM Plex Mono", fontSize: 44 }}>{unit}</span>
          </div>
          <span style={{ fontSize: 32, color: "#46606f", marginTop: 14 }}>{line}</span>
        </div>
        <div style={{ display: "flex", height: 2, background: "#cfdbe1" }} />
      </div>
    ),
    {
      ...OG_SIZE,
      fonts: [
        { name: "Schibsted Grotesk", data: display, weight: 700, style: "normal" },
        { name: "IBM Plex Mono", data: mono, weight: 500, style: "normal" },
      ],
      headers: { "Cache-Control": "public, max-age=3600, s-maxage=3600" },
    },
  );
}
