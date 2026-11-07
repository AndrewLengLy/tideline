import localFont from "next/font/local";

export const schibsted = localFont({
  src: [
    { path: "../node_modules/@fontsource/schibsted-grotesk/files/schibsted-grotesk-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../node_modules/@fontsource/schibsted-grotesk/files/schibsted-grotesk-latin-700-normal.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-schibsted",
  display: "swap",
});

export const plexMono = localFont({
  src: [
    { path: "../node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-500-normal.woff2", weight: "500", style: "normal" },
  ],
  variable: "--font-plex",
  display: "swap",
});
