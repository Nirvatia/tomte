import { test, expect } from "@playwright/test";

/**
 * Удаление файла промпта: файл с текстом удаляется только после
 * подтверждения, а сразу после удаления его ещё можно вернуть.
 */
test("удаление промпта с текстом спрашивает подтверждение", async ({
  page,
}) => {
  await page.goto("/");
  const editor = page.locator(".tiptap-prose");
  await expect(editor).toBeEditable({ timeout: 15_000 });
  await editor.click();
  await page.keyboard.type("Важный промпт");
  // Удаляем сразу, не дожидаясь автосохранения: текст ещё в редакторе,
  // но подтверждение всё равно должно появиться.

  const toggle = page.getByRole("button", {
    name: "Открыть панель структуры проекта",
  });
  if ((await toggle.getAttribute("class"))?.includes("accent-dim") !== true) {
    await toggle.click();
  }
  const fileRow = page.getByRole("button", { name: "main", exact: true });
  const deleteButton = page.getByRole("button", { name: "Удалить файл main" });
  // Кнопка удаления видна при наведении на строку файла.
  const clickDelete = async () => {
    await fileRow.hover();
    await deleteButton.click();
  };
  const confirm = page.getByRole("alertdialog", {
    name: "Удалить файл промпта?",
  });

  // Отказ: файл на месте.
  await clickDelete();
  await expect(confirm).toBeVisible();
  await expect(confirm).toContainText("«main» (13 символов)");
  await confirm.getByRole("button", { name: "Отмена" }).click();
  await expect(confirm).toBeHidden();
  await expect(editor).toContainText("Важный промпт");

  // Подтверждение: файл удалён, на его месте пустой.
  await clickDelete();
  await confirm.getByRole("button", { name: "Удалить" }).click();
  await expect(page.getByText("Файл «main» удалён")).toBeVisible();
  await expect(editor).not.toContainText("Важный промпт");

  // Отмена в уведомлении возвращает текст.
  await page
    .locator("[data-sonner-toast]")
    .getByRole("button", { name: "Отменить" })
    .click();
  await expect(editor).toContainText("Важный промпт");
});
