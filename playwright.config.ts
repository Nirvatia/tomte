import { defineConfig, devices } from "@playwright/test";

// Этап 12.5. Firefox и WebKit (движок Safari) гоняют сценарии, где браузеры
// расходятся: редактор, адаптив, тур. Полный набор — на Chromium.
// В CI всегда, локально — по E2E_ALL_BROWSERS=1 (нужны `npx playwright
// install firefox webkit`).
const ALL_BROWSERS = Boolean(process.env.CI || process.env.E2E_ALL_BROWSERS);
const CROSS_BROWSER_SPECS = /(editor|adaptive|onboarding)\.spec\.ts$/;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: "http://localhost:5173",
    // Тесты написаны на русском: язык интерфейса берётся из браузера.
    locale: "ru-RU",
    trace: "on-first-retry",
    // Этап 5.8: тур при первом запуске закрывает интерфейс — в тестах он
    // отключён, сценарии тура живут в onboarding.spec.ts со своим контекстом.
    storageState: "tests/e2e/.onboarded.json",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    ...(ALL_BROWSERS
      ? [
          {
            name: "firefox",
            use: { ...devices["Desktop Firefox"] },
            testMatch: CROSS_BROWSER_SPECS,
          },
          {
            name: "webkit",
            use: { ...devices["Desktop Safari"] },
            testMatch: CROSS_BROWSER_SPECS,
          },
        ]
      : []),
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
