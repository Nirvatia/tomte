import { test, expect } from "@playwright/test";

const themeOf = (page: import("@playwright/test").Page) =>
  page.evaluate(() => document.documentElement.dataset.theme);

test("по умолчанию тема как в системе — и ставится до отрисовки", async ({
  browser,
}) => {
  for (const colorScheme of ["light", "dark"] as const) {
    const context = await browser.newContext({ locale: "ru-RU", colorScheme });
    const page = await context.newPage();
    // Тему ставит скрипт в <head>: проверяем на DOMContentLoaded,
    // до того как запустилось приложение.
    await page.goto("/", { waitUntil: "domcontentloaded" });
    expect(await themeOf(page)).toBe(colorScheme);
    await context.close();
  }
});

test("переключатель меняет тему и запоминает выбор", async ({ browser }) => {
  const context = await browser.newContext({
    locale: "ru-RU",
    colorScheme: "dark",
  });
  const page = await context.newPage();
  await page.goto("/");
  await expect(page.locator(".tiptap-prose")).toBeEditable({
    timeout: 15_000,
  });

  await page.getByRole("button", { name: "Настройки" }).click();
  await page.getByRole("menuitemradio", { name: "Светлая" }).click();
  expect(await themeOf(page)).toBe("light");
  // Переключатель темы оставляет меню открытым: эффект виден сразу.
  await expect(
    page.getByRole("menuitemradio", { name: "Светлая" }),
  ).toHaveAttribute("aria-checked", "true");
  await page.keyboard.press("Escape");

  // Цвета действительно поменялись: фон светлой темы — мягкий off-white, не чисто белый.
  const background = await page
    .locator(".app-root")
    .evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(background).toBe("rgb(251, 252, 252)");

  await page.reload();
  expect(await themeOf(page)).toBe("light");

  await page.getByRole("button", { name: "Настройки" }).click();
  await page.getByRole("menuitemradio", { name: "Как в системе" }).click();
  expect(await themeOf(page)).toBe("dark");
  await context.close();
});

test("настройки: язык, обучение и горячие клавиши", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".tiptap-prose")).toBeEditable({
    timeout: 15_000,
  });
  const settings = page.getByRole("button", { name: "Настройки" });

  await settings.click();
  await page.getByRole("menuitemradio", { name: "English" }).click();
  await expect(page.getByRole("button", { name: "Settings" })).toBeVisible();
  await page.getByRole("menuitemradio", { name: "Русский" }).click();
  await page.keyboard.press("Escape");

  await settings.click();
  await page.getByRole("menuitem", { name: "Горячие клавиши" }).click();
  await expect(
    page.getByRole("dialog", { name: "Горячие клавиши" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");

  await settings.click();
  await page.getByRole("menuitem", { name: "Обучение" }).click();
  await expect(page.getByRole("dialog", { name: "Обучение" })).toBeVisible();
});
