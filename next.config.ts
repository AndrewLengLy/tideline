import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";
const isPreview = process.env.VERCEL_ENV === "preview";

// Tile hosts the browser reaches directly: OpenFreeMap, AWS terrain, USGS imagery, and NOAA sea level rise.
const TILE_HOSTS = "https://tiles.openfreemap.org https://s3.amazonaws.com https://basemap.nationalmap.gov https://coast.noaa.gov";
const PREVIEW = isPreview ? " https://vercel.live https://*.vercel.live" : "";

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}${PREVIEW}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${TILE_HOSTS}${PREVIEW}`,
  "font-src 'self' data:",
  `connect-src 'self' ${TILE_HOSTS}${isDev ? " ws:" : ""}${PREVIEW}`,
  "worker-src 'self' blob:",
  "child-src 'self' blob:",
  `frame-src 'self'${PREVIEW}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  outputFileTracingIncludes: {
    "/**/opengraph-image": ["./node_modules/@fontsource/schibsted-grotesk/files/*.woff", "./node_modules/@fontsource/ibm-plex-mono/files/*.woff"],
    "/**/twitter-image": ["./node_modules/@fontsource/schibsted-grotesk/files/*.woff", "./node_modules/@fontsource/ibm-plex-mono/files/*.woff"],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "geolocation=(), camera=(), microphone=()" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
