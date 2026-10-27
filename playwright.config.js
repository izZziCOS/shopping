import { defineConfig } from "@playwright/test";

const CI = Boolean(process.env.CI);

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  workers: 1,
  retries: CI ? 1 : 0,
  reporter: CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://127.0.0.1:4173",
    channel: CI ? undefined : "chrome",
    locale: "en-US",
    timezoneId: "Europe/Vilnius",
    viewport: { width: 390, height: 844 },
    trace: "retain-on-failure",
  },
  webServer: {
    command: "node tests/e2e/serve.js",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !CI,
  },
});
