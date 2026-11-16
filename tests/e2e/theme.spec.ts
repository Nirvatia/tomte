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

  await page.getByRole("button", { name: "Тема оформления" }).click();
  await page.getByRole("menuitem", { name: "Светлая" }).click();
  expect(await themeOf(page)).toBe("light");
  // Меню закрылось после выбора.
  await expect(
    page.getByRole("menu", { name: "Тема оформления" }),
  ).toBeHidden();

  // Цвета действительно поменялись: фон редактора белый.
  const background = await page
    .locator(".app-root")
    .evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(background).toBe("rgb(255, 255, 255)");

  await page.reload();
  expect(await themeOf(page)).toBe("light");

  await page.getByRole("button", { name: "Тема оформления" }).click();
  await page.getByRole("menuitem", { name: "Как в системе" }).click();
  expect(await themeOf(page)).toBe("dark");
  await context.close();
});
