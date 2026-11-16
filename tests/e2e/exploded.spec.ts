import { expect, test, type Page } from "@playwright/test";

type EngineWindow = { __tideEngine?: { apart: boolean; map: { getPitch: () => number } } };

/** The slider foot that matches the next king tide, read from the slider's marker. */
async function kingFoot(page: Page): Promise<number> {
  const title = await page.getByTestId("king-marker").getAttribute("title");
  const m = /Next king tide, (\d+(?:\.\d+)?) ft/.exec(title ?? "");
  expect(m, "king tide marker").not.toBeNull();
  return Math.round(Number(m![1]));
}

test.describe("exploded water layers on desktop", () => {
  test.beforeEach(({}, info) => {
    test.skip(!info.project.name.includes("1440"), "Taking the map apart is a desktop control.");
  });

  test("takes the map apart and puts it back, round-tripping through the URL", async ({ page }) => {
    await page.goto("/?station=9414750&ft=3");
    const toggle = page.getByTestId("apart-toggle");
    await expect(toggle).toHaveText("Take it apart", { timeout: 40_000 });
    await toggle.click();
    await expect(toggle).toHaveText("Put it back together");
    await expect(page).toHaveURL(/[?&]view=apart/);
    await expect.poll(() => page.evaluate(() => (window as unknown as EngineWindow).__tideEngine?.apart)).toBe(true);
    await expect.poll(() => page.evaluate(() => Math.round((window as unknown as EngineWindow).__tideEngine?.map.getPitch() ?? 0)), { timeout: 10_000 }).toBe(60);
    // Three slabs at Alameda: average high tide, the king tide step, and +3 ft.
    await expect(page.locator(".stack-card")).toHaveCount(3);
    await expect(page.locator('.stack-card[data-kind="average"]')).toHaveText("Average high tide. On a normal day the water stops here.");
    await expect(page.locator('.stack-card[data-kind="slider"]')).toContainText("+3 ft of sea level rise.");
    await expect(page.locator('.stack-card[data-kind="king"]')).toHaveText(/^King tide, \w{3} \w{3} \d{1,2}, \d+\.\d ft\. This is \d+\.\d ft above an average high tide\.$/);

    await page.reload();
    await expect(page.getByTestId("apart-toggle")).toHaveText("Put it back together", { timeout: 40_000 });
    await expect.poll(() => page.evaluate(() => (window as unknown as EngineWindow).__tideEngine?.apart)).toBe(true);

    await page.getByTestId("apart-toggle").click();
    await expect(page.getByTestId("apart-toggle")).toHaveText("Take it apart");
    await expect(page).not.toHaveURL(/view=apart/);
  });

  test("merges the king tide and the slider into one slab when they land on the same foot", async ({ page }) => {
    await page.goto("/?station=9414750");
    const foot = await kingFoot(page);
    test.skip(foot < 1, "The next king tide sits at an average high tide, so there is no slab to merge.");
    await page.goto(`/?station=9414750&ft=${foot}&view=apart`);
    const merged = page.locator('.stack-card[data-kind="merged"]');
    await expect(merged).toHaveText(new RegExp(`^Same water on two dates\\. The \\w{3} \\d{1,2} king tide reaches this line today\\. With ${foot} ft of sea level rise, an ordinary high tide reaches it\\.$`), { timeout: 40_000 });
    await expect(page.locator(".stack-card")).toHaveCount(2);
  });

  test("the scrubber moves a marker along the stack", async ({ page }) => {
    await page.goto("/?station=9414750&ft=2&view=apart");
    const marker = page.locator(".stack-marker");
    await expect(marker).toHaveText(/^(Now|\w{3} \w{3} \d{1,2}, \d{1,2}:\d{2} [AP]M): \d+\.\d ft$/, { timeout: 40_000 });
    const before = await marker.textContent();
    const slider = page.getByRole("slider", { name: "Scrubber time" }).first();
    await slider.focus();
    await page.keyboard.press("Home");
    await expect(marker).not.toHaveText(before ?? "");
  });
});

test("phones hide the control and list the same slabs in the sheet", async ({ page }, info) => {
  test.skip(!info.project.name.includes("375"), "The flat legend is the phone layout.");
  await page.goto("/?station=9414750&ft=3&view=apart");
  await expect(page.getByRole("slider", { name: "Scrubber time" }).first()).toBeVisible({ timeout: 40_000 });
  await expect(page.getByTestId("apart-toggle")).toHaveCount(0);
  await page.getByRole("button", { name: "Show details" }).click();
  await page.getByRole("tab", { name: "Gauge" }).click();
  const legend = page.getByTestId("stack-legend");
  await expect(legend).toBeVisible();
  await expect(legend.locator("li")).toHaveCount(3);
  await expect(legend.locator("li").first()).toContainText("+3 ft of sea level rise.");
});
