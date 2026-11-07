import { defineConfig } from "@playwright/test";

const chrome = process.env.PW_CHROME_PATH;

export default defineConfig({
  testDir: "tests/e2e",
  testIgnore: "**/._*",
  timeout: 90_000,
  retries: process.env.CI ? 1 : 0,
  workers: 2,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3120",
    launchOptions: {
      ...(chrome ? { executablePath: chrome } : {}),
      args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
    },
  },
  projects: [
    { name: "mobile-375", use: { viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } },
    { name: "desktop-1440", use: { viewport: { width: 1440, height: 900 } } },
  ],
  webServer: {
    command: "npx next start -p 3120",
    url: "http://localhost:3120/methodology",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
