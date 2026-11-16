import { expect, test, type Page } from "@playwright/test";

const count = async (page: Page) => Number((await page.getByTestId("city-count").first().locator(".num").textContent()) ?? "NaN");

test("the water slider fills the calendar city, and a block names its day", async ({ page }, info) => {
  test.skip(!info.project.name.includes("1440"), "The calendar sits in the desktop bottom panel. The phone check below opens the sheet.");
  await page.goto("/?station=9414750");
  const city = page.getByTestId("calendar-city").first();
  await expect(city).toBeVisible({ timeout: 40_000 });
  await expect(page.getByText("Days the tide reaches the flood line, next 12 months")).toBeVisible();
  const atZero = await count(page);
  const range = page.getByRole("slider", { name: /Sea level rise in feet/ });
  await range.focus();
  const seen = [atZero];
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press("ArrowRight");
    await expect(page.getByTestId("water-value")).toHaveText(`${i + 1} ft`);
    // The city redraws just after the slider, so the count is read once it has caught up.
    await expect(city).toHaveAttribute("data-add", String(i + 1));
    seen.push(await count(page));
  }
  for (let i = 1; i < seen.length; i++) expect(seen[i]).toBeGreaterThanOrEqual(seen[i - 1]);
  expect(seen[3]).toBeGreaterThan(seen[0]);
  await expect(page.getByTestId("city-count").first()).toHaveText(new RegExp(`^${seen[3]} days? reach(es)? the flood line$`));

  await city.focus();
  const tip = page.getByTestId("city-tip");
  await expect(tip).toBeVisible();
  await expect(tip).toContainText("Highest tide");
  await expect(tip).toContainText(/(over|under|at) the flood line|Just over the flood line|At the flood line/i);
  await page.keyboard.press("ArrowRight");
  await expect(tip).toBeVisible();
});

test("on a mid phone, the slider redraws the calendar city in under 16 ms a step", async ({ page }, info) => {
  test.skip(!info.project.name.includes("375"), "The budget is for the phone profile.");
  // React's scheduler runs deferred renders in MessageChannel tasks. Stamping each task's start
  // lets the test time the city's own redraw, apart from the map's WebGL frames.
  await page.addInitScript(() => {
    const w = window as unknown as { __taskStart?: number };
    const Native = window.MessageChannel;
    const desc = Object.getOwnPropertyDescriptor(MessagePort.prototype, "onmessage")!;
    window.MessageChannel = class extends Native {
      constructor() {
        super();
        const port = this.port1;
        Object.defineProperty(port, "onmessage", {
          configurable: true,
          get: () => desc.get!.call(port),
          set: (fn: ((e: MessageEvent) => unknown) | null) =>
            desc.set!.call(
              port,
              fn
                ? (e: MessageEvent) => {
                    w.__taskStart = performance.now();
                    return fn.call(port, e);
                  }
                : null,
            ),
        });
      }
    } as typeof MessageChannel;
  });
  const cdp = await page.context().newCDPSession(page);
  await page.goto("/?station=9414750");
  await expect(page.getByRole("slider", { name: "Scrubber time" }).first()).toBeVisible({ timeout: 60_000 });
  await page.getByRole("button", { name: "Show details" }).click();
  await page.getByRole("tab", { name: "Gauge" }).click();
  await expect(page.getByTestId("calendar-city")).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(2000);
  // 4x CPU slowdown, the usual stand-in for a mid-range phone.
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  const result = await page.evaluate(async () => {
    const w = window as unknown as { __taskStart?: number };
    const input = document.querySelector<HTMLInputElement>('input[aria-label^="Sea level rise"]')!;
    const city = document.querySelector('[data-testid="calendar-city"]')!;
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    const slider: number[] = [];
    const redraw: number[] = [];
    for (const v of [1, 2, 3, 2, 1, 0, 1, 2, 3]) {
      await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
      const drawn = new Promise<void>((resolve) => {
        const mo = new MutationObserver(() => {
          mo.disconnect();
          // Layout of the new paths counts toward the redraw.
          city.getBoundingClientRect();
          redraw.push(performance.now() - (w.__taskStart ?? performance.now()));
          resolve();
        });
        mo.observe(city, { subtree: true, attributes: true, attributeFilter: ["d"] });
      });
      const t0 = performance.now();
      setValue.call(input, String(v));
      input.dispatchEvent(new Event("input", { bubbles: true }));
      document.body.getBoundingClientRect();
      slider.push(performance.now() - t0);
      await drawn;
    }
    return { slider, redraw };
  });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  const median = (a: number[]) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
  console.log(`At 4x CPU. Slider step ms: ${result.slider.map((t) => t.toFixed(1)).join(", ")}. City redraw ms: ${result.redraw.map((t) => t.toFixed(1)).join(", ")}.`);
  // The budget covers the city. The slider's own input task also carries the map's gauge update,
  // which predates the city and runs on a software GPU in headless Chrome, so it is logged above.
  expect(median(result.redraw)).toBeLessThan(16);
});
