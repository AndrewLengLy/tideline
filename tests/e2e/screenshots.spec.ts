import { test } from "@playwright/test";

// The PR screenshots of the default 3D view. Run with: SHOTS=1 npx playwright test screenshots
test.skip(!process.env.SHOTS, "Set SHOTS=1 to capture the default view screenshots.");

test("default 3D view", async ({ page }, info) => {
  test.setTimeout(120_000);
  await page.goto("/");
  await page.locator("canvas.maplibregl-canvas").first().waitFor({ state: "attached", timeout: 40_000 });
  await page.waitForTimeout(32_000);
  const width = info.project.name.includes("375") ? 375 : 1440;
  await page.screenshot({ path: `docs/screenshots/default-3d-${width}.png` });
});
