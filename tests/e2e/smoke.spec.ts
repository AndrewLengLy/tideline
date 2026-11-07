import { expect, test } from "@playwright/test";

test("map page loads with a server-rendered headline", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.locator("h1")).toHaveText("SF Bay king tides and sea level rise");
  await expect(page.getByRole("region", { name: /3D map of San Francisco Bay/ })).toBeAttached();
  await expect(page.locator("canvas.maplibregl-canvas").first()).toBeAttached({ timeout: 30_000 });
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(width).toBeLessThanOrEqual(page.viewportSize()!.width);
  expect(errors).toEqual([]);
});

test("server HTML carries the h1 and headline text before any script runs", async ({ request }) => {
  const html = await (await request.get("/")).text();
  expect(html).toContain("SF Bay king tides and sea level rise");
  expect(html).toMatch(/\d\.\d ft high at Alameda sits \d\.\d ft above MHHW/);
});

test("scrubber plays three frames and writes t to the URL", async ({ page }) => {
  await page.goto("/");
  const slider = page.getByRole("slider", { name: "Scrubber time" }).first();
  await expect(slider).toBeVisible();
  await expect.poll(async () => Number(await slider.getAttribute("aria-valuemax"))).toBeGreaterThan(1000);
  await slider.focus();
  await page.keyboard.press("Home");
  await expect(slider).toHaveAttribute("aria-valuenow", "0");
  await page.keyboard.press("ArrowRight");
  await expect(slider).toHaveAttribute("aria-valuenow", "1");
  await page.getByRole("button", { name: "Play tide playback" }).first().click();
  await expect.poll(async () => Number(await slider.getAttribute("aria-valuenow")), { timeout: 20_000 }).toBeGreaterThanOrEqual(4);
  await expect(page).toHaveURL(/[?&]t=\d{4}-\d{2}-\d{2}T\d{2}:\d{2}Z/);
});

test("water slider changes the step and the URL", async ({ page }) => {
  await page.goto("/");
  const range = page.getByRole("slider", { name: /Sea level rise in feet/ });
  await range.focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await expect(page.getByTestId("water-value")).toHaveText("3 ft");
  await expect(page).toHaveURL(/[?&]ft=3/);
});

test("moving the slider while tiles load still swaps the NOAA layer", async ({ page }) => {
  await page.goto("/");
  await page.locator("canvas.maplibregl-canvas").first().waitFor({ state: "attached", timeout: 40_000 });
  type EngineWindow = { __tideEngine?: { map: { getLayer: (id: string) => unknown; getPaintProperty: (id: string, p: string) => unknown } } };
  await expect.poll(() => page.evaluate(() => !!(window as unknown as EngineWindow).__tideEngine?.map.getLayer("slr-0")), { timeout: 40_000 }).toBe(true);
  const range = page.getByRole("slider", { name: /Sea level rise in feet/ });
  await range.focus();
  for (let i = 0; i < 5; i++) await page.keyboard.press("ArrowRight");
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const map = (window as unknown as EngineWindow).__tideEngine?.map;
          return map?.getLayer("slr-5") ? map.getPaintProperty("slr-5", "raster-opacity") : -1;
        }),
      { timeout: 20_000 },
    )
    .toBeGreaterThan(0.5);
});

test("the scale bar sits on screen, clear of the panels", async ({ page }) => {
  await page.goto("/");
  const scale = page.locator(".maplibregl-ctrl-scale").first();
  await expect(scale).toBeVisible({ timeout: 40_000 });
  await expect(scale).toHaveText(/\d+\s*(ft|mi)/);
  const box = (await scale.boundingBox())!;
  const covering = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.closest(".maplibregl-map") !== null, [box.x + box.width / 2, box.y + box.height / 2]);
  expect(covering).toBe(true);
});

test("phone controls meet the 44px minimum", async ({ page }, info) => {
  test.skip(!info.project.name.includes("375"), "Touch targets apply to the phone layout.");
  await page.goto("/");
  await expect(page.getByRole("slider", { name: "Scrubber time" }).first()).toBeVisible();
  await page.getByRole("button", { name: "Show details" }).click();
  await page.getByRole("tab", { name: "Layers" }).waitFor();
  const small = await page.evaluate(() => {
    const out: string[] = [];
    for (const el of document.querySelectorAll("button, select, [role=tab], input[type=range]")) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.width < 44 || r.height < 44) out.push(`${el.tagName} ${el.getAttribute("aria-label") ?? el.textContent?.slice(0, 20)} ${Math.round(r.width)}x${Math.round(r.height)}`);
    }
    return out;
  });
  expect(small).toEqual([]);
});

test("station page renders its h1 and headline number", async ({ page }) => {
  await page.goto("/stations/alameda");
  await expect(page.locator("h1")).toHaveText("Alameda tide station");
  await expect(page.getByTestId("headline-number").first()).toHaveText(/^\d+\.\d ft$/);
  await expect(page.getByText("Days over threshold, next 12 months")).toBeVisible();
  await expect(page.getByText("Last 72 hours", { exact: true })).toBeVisible();
});

test("a station with no threshold says so", async ({ page }) => {
  await page.goto("/stations/redwood-city");
  await expect(page.getByText("NOAA publishes no minor, moderate, or major high tide flooding thresholds for this gauge.")).toBeVisible();
});

test("spot page renders its h1 and headline number", async ({ page }) => {
  await page.goto("/spots/crab-cove-alameda");
  await expect(page.locator("h1")).toContainText("Crab Cove");
  await expect(page.getByTestId("headline-number").first()).toHaveText(/^(\d+ ft|above 10 ft)$/);
  await expect(page.getByRole("link", { name: /California King Tides Project upload form/ })).toBeVisible();
});

test("calendar lists 20 tides and exports a calendar file", async ({ page }) => {
  await page.goto("/king-tides");
  await expect(page.locator("h1")).toHaveText("King tide calendar for San Francisco Bay");
  await expect(page.locator("tbody tr")).toHaveCount(20);
  const download = page.waitForEvent("download");
  await page.locator("tbody tr").first().getByRole("button").click();
  expect((await download).suggestedFilename()).toMatch(/^king-tide-[a-z-]+-\d{4}-\d{2}-\d{2}\.ics$/);
});

test("methodology carries the safety line and one h1", async ({ page }) => {
  await page.goto("/methodology");
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(page.locator("article").getByText("For situational awareness only. Follow official alerts and evacuation orders.")).toBeVisible();
});
