import { test, expect } from "@playwright/test";

/**
 * Этап 10.3. История версий: снапшот через контекстное меню файла,
 * diff со следующей редакцией, восстановление возвращает текст.
 */

test("история версий: снапшот, diff, восстановление", async ({ page }) => {
  const first = "первая-редакция-42";
  const second = "вторая-редакция-43";

  await page.goto("/");
  const editor = page
    .locator(".tiptap-wrapper [contenteditable='true']")
    .first();
  await expect(editor).toBeEditable({ timeout: 15_000 });

  await editor.click();
  await page.keyboard.type(first);

  // Снапшот через контекстное меню вкладки.
  await page.getByRole("tab", { name: "Вкладка main" }).click({
    button: "right",
  });
  await page.getByRole("menuitem", { name: "История версий" }).click();

  const dialog = page.getByRole("dialog", { name: "История: main" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Сохранить версию" }).click();
  await expect(dialog.getByText("Версия 1")).toBeVisible();

  // Вторая редакция, diff должен показать замену.
  await page.keyboard.press("Escape");
  await editor.click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.type(second);

  await page.getByRole("tab", { name: "Вкладка main" }).click({
    button: "right",
  });
  await page.getByRole("menuitem", { name: "История версий" }).click();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(second)).toBeVisible();
  await expect(dialog.getByText(first)).toBeVisible();

  // Восстанавливаем версию 1 — текст в редакторе снова первый.
  await dialog.getByRole("button", { name: "Восстановить эту версию" }).click();
  await expect(page.getByText("Версия восстановлена")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(editor).toContainText(first);
});
