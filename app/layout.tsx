import type { Metadata, Viewport } from "next";
import { jsonLdHtml } from "@/lib/jsonld";
import { AUTHOR_ID, AUTHOR_NAME, AUTHOR_URL, SITE_NAME, SITE_URL } from "@/lib/site";
import { plexMono, schibsted } from "./fonts";
import "./globals.css";

const description = "When the highest tides of the year reach San Francisco Bay, where that water lands today, and where high tides reach with 1 to 10 ft of sea level rise.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "Tideline | SF Bay King Tides and Sea Level Rise", template: "%s | Tideline" },
  description,
  applicationName: SITE_NAME,
  authors: [{ name: AUTHOR_NAME, url: AUTHOR_URL }],
  alternates: { canonical: "/" },
  openGraph: { type: "website", siteName: SITE_NAME, url: "/", title: "Tideline | SF Bay King Tides and Sea Level Rise", description },
  twitter: { card: "summary_large_image", title: "Tideline | SF Bay King Tides and Sea Level Rise", description },
  // Preview deployments stay out of search. Production pages are all indexable.
  robots: process.env.VERCEL_ENV === "production" ? { index: true, follow: true } : { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#eef3f5",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: SITE_NAME,
  url: SITE_URL,
  applicationCategory: "ReferenceApplication",
  operatingSystem: "Web",
  isAccessibleForFree: true,
  creator: { "@type": "Person", "@id": AUTHOR_ID, name: AUTHOR_NAME, url: AUTHOR_URL },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${schibsted.variable} ${plexMono.variable}`}>
      <body>
        <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdHtml(jsonLd)} />
        {children}
      </body>
    </html>
  );
}
