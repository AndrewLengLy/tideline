import { expect, test, type Page } from "@playwright/test";
import { fmtAsOf } from "../../lib/format";

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

/** An observed response in the route's own shape: rows of [minutes after t0, feet]. */
function observed(station: string, asOf: number) {
  const t0 = asOf - 72 * 60 * MINUTE;
  const rows: [number, number][] = [];
  for (let m = 0; m <= 72 * 60; m += 6) rows.push([m, 3.4 + 2.2 * Math.sin(m / 372)]);
  return { station, asOf, t0, observed: rows, residual: rows.map(([m]) => [m, 0.1] as [number, number]), surge: null };
}

/** Serves `first` to the plain request and `second` to the cache-busting retry, which answers after a pause. */
async function mockObserved(page: Page, first: number, second: number) {
  const seen = { plain: 0, retry: 0 };
  await page.route(/\/api\/observed\/\d+/, async (route) => {
    const url = new URL(route.request().url());
    const station = url.pathname.split("/").pop()!;
    if (url.searchParams.has("t")) {
      seen.retry++;
      await new Promise((r) => setTimeout(r, 1500));
      return route.fulfill({ json: observed(station, second) });
    }
    seen.plain++;
    return route.fulfill({ json: observed(station, first) });
  });
  return seen;
}

test.describe("first visit after a quiet stretch", () => {
  test.beforeEach(({}, info) => {
    test.skip(!info.project.name.includes("1440"), "The water level chart label sits in the desktop bottom panel.");
  });

  test("an old reading says it is updating, then shows the fresh time", async ({ page }) => {
    const now = Date.now();
    const fresh = now - 5 * MINUTE;
    const seen = await mockObserved(page, now - 4.5 * DAY, fresh);
    await page.goto("/");
    const label = page.getByTestId("reading-label").first();
    await expect(label).toHaveText("Updating to the latest reading", { timeout: 20_000 });
    await expect(label).toHaveText(fmtAsOf(fresh), { timeout: 20_000 });
    await expect(page.getByTestId("reading-warning")).toHaveCount(0);
    expect(seen.retry).toBeGreaterThan(0);
  });

  test("a reading still old after the retry shows its true age in the warning color", async ({ page }) => {
    const now = Date.now();
    const old = now - 4.5 * DAY;
    await mockObserved(page, old, old);
    await page.goto("/");
    const warning = page.getByTestId("reading-warning").first();
    await expect(warning).toHaveText("Last reading 4 days ago. NOAA may be down for this gauge.", { timeout: 20_000 });
    await expect(warning).toHaveClass(/text-coral-ink/);
  });

  test("a current reading never asks twice", async ({ page }) => {
    const now = Date.now();
    const seen = await mockObserved(page, now - 8 * MINUTE, now - 2 * MINUTE);
    await page.goto("/");
    await expect(page.getByTestId("reading-label").first()).toHaveText(fmtAsOf(now - 8 * MINUTE), { timeout: 20_000 });
    expect(seen.retry).toBe(0);
  });
});
