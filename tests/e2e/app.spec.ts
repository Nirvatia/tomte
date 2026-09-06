import { test, expect } from "@playwright/test";

test.describe("Приложение", () => {
  test("открывается без ошибок и рендерит основные зоны", async ({ page }) => {
    await page.goto("/");

    // Ждём инициализацию проекта (IndexedDB)
    // После инициализации появляется активный файл в табах
    await expect(
      page.getByRole("tablist", { name: "Файлы промптов" }),
    ).toBeVisible({ timeout: 15_000 });

    // Редактор виден
    await expect(
      page.getByRole("region", { name: "Область редактора" }),
    ).toBeVisible();

    // Тулбар виден
    await expect(
      page.getByRole("button", { name: "Открыть меню инструментов" }),
    ).toBeVisible();

    // Сайдбар проекта виден (кнопка структуры проекта)
    await expect(
      page.getByRole("button", { name: "Открыть панель структуры проекта" }),
    ).toBeVisible();

    // Заголовок страницы
    await expect(page).toHaveTitle(/Tomte/);
  });

  test("нет ошибок в консоли при загрузке", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        errors.push(msg.text());
      }
    });

    await page.goto("/");

    // Ждём появления редактора
    await expect(
      page.getByRole("region", { name: "Область редактора" }),
    ).toBeVisible({ timeout: 15_000 });

    // Фильтруем известные безвредные ошибки (если есть)
    const criticalErrors = errors.filter(
      (e) => !e.includes("favicon") && !e.includes("404"),
    );

    expect(criticalErrors).toHaveLength(0);
  });
});