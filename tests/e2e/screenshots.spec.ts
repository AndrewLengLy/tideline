import { expect, test } from "@playwright/test";

// The PR screenshots. Run with: SHOTS=1 npx playwright test screenshots
test.skip(!process.env.SHOTS, "Set SHOTS=1 to capture the screenshots.");

test("default 3D view", async ({ page }, info) => {
  test.setTimeout(120_000);
  await page.goto("/");
  await page.locator("canvas.maplibregl-canvas").first().waitFor({ state: "attached", timeout: 40_000 });
  await page.waitForTimeout(32_000);
  const width = info.project.name.includes("375") ? 375 : 1440;
  await page.screenshot({ path: `docs/screenshots/default-3d-${width}.png` });
});

/** The slider foot that matches the next king tide, so the stack shows the merged slab. */
async function kingFoot(page: import("@playwright/test").Page): Promise<number> {
  const title = (await page.getByTestId("king-marker").getAttribute("title")) ?? "";
  return Math.max(1, Math.round(Number(/(\d+(?:\.\d+)?) ft/.exec(title)?.[1] ?? 1)));
}

test("exploded view at Alameda with the merged slab", async ({ page }, info) => {
  test.skip(!info.project.name.includes("1440"), "Taken apart on desktop. The phone shot is below.");
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/?station=9414750");
  const foot = await kingFoot(page);
  await page.goto(`/?station=9414750&ft=${foot}&view=apart`);
  await expect(page.locator('.stack-card[data-kind="merged"]')).toBeAttached({ timeout: 40_000 });
  await page.waitForTimeout(30_000);
  await page.screenshot({ path: "docs/screenshots/exploded-1440.png" });
});

test("phone legend and calendar city at Alameda", async ({ page }, info) => {
  test.skip(!info.project.name.includes("375"), "The phone layout.");
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?station=9414750");
  const foot = await kingFoot(page);
  await page.goto(`/?station=9414750&ft=${foot}`);
  await page.locator("canvas.maplibregl-canvas").first().waitFor({ state: "attached", timeout: 40_000 });
  await page.waitForTimeout(20_000);
  await page.getByRole("button", { name: "Show details" }).click();
  await page.getByRole("tab", { name: "Gauge" }).click();
  await expect(page.getByTestId("stack-legend")).toBeVisible();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: "docs/screenshots/exploded-390.png" });
});
