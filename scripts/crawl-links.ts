// Broken link crawl. Starts from the sitemap and the home page, follows every internal link,
// and checks each external link once. Run against a production build: npm run crawl -- http://localhost:3120
const BASE = process.argv[2] ?? "http://localhost:3120";
const SITE = "https://tides.andrewlengly.com";

const toLocal = (u: string) => (u.startsWith(SITE) ? BASE + u.slice(SITE.length) : u);

async function main() {
  const sitemap = await (await fetch(`${BASE}/sitemap.xml`)).text();
  const queue = new Set<string>([`${BASE}/`, ...[...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => toLocal(m[1]))]);
  const seen = new Map<string, number>();
  const external = new Map<string, string>();
  const missing: string[] = [];

  for (const url of queue) {
    const res = await fetch(url, { redirect: "manual" });
    seen.set(url, res.status);
    if (res.status >= 400) missing.push(`${res.status} ${url}`);
    if (!(res.headers.get("content-type") ?? "").includes("text/html")) continue;
    const html = await res.text();
    for (const m of html.matchAll(/href="([^"#]+)"/g)) {
      const raw = m[1].replaceAll("&amp;", "&");
      if (raw.startsWith("/_next") || raw.endsWith(".css") || raw.startsWith("mailto:")) continue;
      if (raw.startsWith("/")) {
        const clean = raw.split("?")[0];
        queue.add(BASE + clean);
      } else if (raw.startsWith(SITE)) {
        queue.add(toLocal(raw).split("?")[0]);
      } else if (raw.startsWith("http")) {
        if (!external.has(raw)) external.set(raw, url);
      }
    }
  }

  const bad: string[] = [];
  for (const [url, from] of external) {
    try {
      const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, redirect: "follow", signal: AbortSignal.timeout(20_000) });
      if (r.status >= 400) bad.push(`${r.status} ${url} (linked from ${from.replace(BASE, "")})`);
    } catch (e) {
      bad.push(`ERR ${url} (linked from ${from.replace(BASE, "")}): ${e instanceof Error ? e.message : e}`);
    }
  }

  const pages = [...seen.keys()].length;
  console.log(`Internal pages crawled: ${pages}. Internal 4xx or 5xx: ${missing.length}.`);
  for (const m of missing) console.log(`  ${m}`);
  console.log(`External links checked: ${external.size}. Failing: ${bad.length}.`);
  for (const b of bad) console.log(`  ${b}`);
  if (missing.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
