import { test, expect } from "@playwright/test";

test.describe("Редактор", () => {
  test("можно ввести текст в редактор", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("region", { name: "Область редактора" }),
    ).toBeVisible({ timeout: 15_000 });

    const editor = page.locator(".tiptap-prose");

    await expect(editor).toBeEditable({ timeout: 15_000 });

    await editor.click();
    await page.keyboard.type("Привет, мир!");

    await expect(editor).toContainText("Привет, мир!");

    // "Привет, мир!" — 12 символов.
    await expect(page.getByText("12 символов")).toBeVisible();
  });

  test("можно создать новый файл промпта через табы", async ({ page }) => {
    await page.goto("/");

    const tablist = page.getByRole("tablist", {
      name: "Файлы промптов",
    });

    await expect(tablist).toBeVisible({ timeout: 15_000 });

    const createButton = tablist.getByRole("button", {
      name: "Создать новый файл промпта",
    });
    await createButton.click();

    // Даём Svelte время обновить DOM
    await page.waitForTimeout(500);

    const nameInput = page.locator('input[placeholder="Имя файла..."]');
    await expect(nameInput).toBeVisible({ timeout: 10_000 });

    await nameInput.fill("test-prompt.md");
    await nameInput.press("Enter");

    await expect(
      page.getByRole("tab", { name: /test-prompt\.md/ }),
    ).toBeVisible();
  });

  test("форматирование текста работает", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("region", { name: "Область редактора" }),
    ).toBeVisible({ timeout: 15_000 });

    const editor = page.locator(".tiptap-prose");

    await expect(editor).toBeEditable({ timeout: 15_000 });

    await editor.click();

    await page.keyboard.type("Жирный текст");
    await page.keyboard.press("Control+A");

    await page.getByRole("button", { name: "Жирный" }).click();

    await expect(editor.locator("strong")).toContainText("Жирный текст");
  });
});
