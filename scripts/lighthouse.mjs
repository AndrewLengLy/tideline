// Lighthouse mobile run on a production build. Usage: npm run lighthouse -- http://localhost:3120 / /stations/alameda
import { mkdirSync, writeFileSync } from "node:fs";
import { launch } from "chrome-launcher";
import lighthouse from "lighthouse";

const BASE = process.argv[2] ?? "http://localhost:3120";
const PATHS = process.argv.slice(3).length ? process.argv.slice(3) : ["/", "/stations/alameda", "/king-tides", "/methodology"];

async function main() {
  mkdirSync("lighthouse", { recursive: true });
  console.log("| Page | Performance | Accessibility | Best Practices | SEO | LCP | CLS | TBT | INP proxy (max FID) |");
  console.log("| --- | --- | --- | --- | --- | --- | --- | --- | --- |");
  for (const path of PATHS) {
    const chrome = await launch({ chromeFlags: ["--headless=new", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
    const result = await lighthouse(`${BASE}${path}`, { port: chrome.port, output: "json", logLevel: "error" });
    await chrome.kill();
    if (!result) throw new Error(`No result for ${path}`);
    const { categories: c, audits: a } = result.lhr;
    const score = (k) => Math.round((c[k]?.score ?? 0) * 100);
    console.log(
      `| ${path} | ${score("performance")} | ${score("accessibility")} | ${score("best-practices")} | ${score("seo")} | ${a["largest-contentful-paint"].displayValue} | ${a["cumulative-layout-shift"].displayValue} | ${a["total-blocking-time"].displayValue} | ${a["max-potential-fid"]?.displayValue ?? ""} |`,
    );
    writeFileSync(`lighthouse/${path === "/" ? "home" : path.replaceAll("/", "_")}.json`, JSON.stringify(result.lhr));
    for (const key of ["accessibility", "best-practices", "seo"]) {
      for (const ref of c[key].auditRefs) {
        const audit = a[ref.id];
        if (ref.weight > 0 && audit.score !== null && audit.score < 1) console.error(`  ${path} ${key}: ${audit.id} (${audit.title})`);
      }
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
