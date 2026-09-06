import { test, expect } from "@playwright/test";

test.describe("Предпросмотр", () => {
  test("открывается через меню инструментов", async ({ page }) => {
    await page.goto("/");

    // Ждём инициализацию
    await expect(
      page.getByRole("region", { name: "Область редактора" }),
    ).toBeVisible({ timeout: 15_000 });

    // Вводим текст в редактор
    const editor = page.locator(".tiptap-prose");
    await editor.click();
    await page.keyboard.type("Тестовый контент для предпросмотра");

    // Открываем меню инструментов
    await page
      .getByRole("button", { name: "Открыть меню инструментов" })
      .click();

    // Кликаем "Предпросмотр"
    await page.getByRole("menuitem", { name: "Предпросмотр" }).click();

    // Модалка предпросмотра открывается
    await expect(
      page.getByRole("dialog", { name: "Предпросмотр промпта" }),
    ).toBeVisible();

    // Контент отображается
    await expect(
      page.getByRole("dialog", { name: "Предпросмотр промпта" }),
    ).toContainText("Тестовый контент для предпросмотра");

    // Закрываем предпросмотр
    await page
      .getByRole("button", { name: "Закрыть предпросмотр" })
      .click();

    await expect(
      page.getByRole("dialog", { name: "Предпросмотр промпта" }),
    ).toBeHidden();
  });

  test("пустой предпросмотр показывает заглушку", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("region", { name: "Область редактора" }),
    ).toBeVisible({ timeout: 15_000 });

    // Не вводим текст, сразу открываем предпросмотр
    await page
      .getByRole("button", { name: "Открыть меню инструментов" })
      .click();
    await page.getByRole("menuitem", { name: "Предпросмотр" }).click();

    // Видим заглушку "Нечего просматривать"
    await expect(page.getByText("Нечего просматривать")).toBeVisible();
  });
});