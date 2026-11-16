import { test, expect } from "@playwright/test";

test.describe("Предпросмотр", () => {
  test("открывается кнопкой в шапке", async ({ page }) => {
    await page.goto("/");

    // Ждём инициализацию
    await expect(
      page.getByRole("region", { name: "Область редактора" }),
    ).toBeVisible({ timeout: 15_000 });

    // Вводим текст в редактор
    const editor = page.locator(".tiptap-prose");
    await editor.click();
    await page.keyboard.type("Тестовый контент для предпросмотра");

    // Кнопка «Предпросмотр» рядом с настройками и экспортом
    await page
      .getByRole("button", { name: "Предпросмотр", exact: true })
      .click();

    // Модалка предпросмотра открывается
    await expect(
      page.getByRole("dialog", { name: "Предпросмотр промпта" }),
    ).toBeVisible();

    // Контент отображается
    await expect(
      page.getByRole("dialog", { name: "Предпросмотр промпта" }),
    ).toContainText("Тестовый контент для предпросмотра");

    // Закрываем предпросмотр
    await page.getByRole("button", { name: "Закрыть предпросмотр" }).click();

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
      .getByRole("button", { name: "Предпросмотр", exact: true })
      .click();

    // Видим заглушку "Нечего просматривать"
    await expect(page.getByText("Нечего просматривать")).toBeVisible();
  });
});
