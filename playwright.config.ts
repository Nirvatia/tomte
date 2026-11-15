import { defineConfig, devices } from "@playwright/test";

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
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
