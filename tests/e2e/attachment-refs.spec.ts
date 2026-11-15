import { test, expect } from "@playwright/test";

/**
 * Этап 5.9. Метки вложений в тексте: подсветка, клик открывает превью,
 * метка без вложения подсвечена как битая и ругается по клику.
 */

test("метки вложений: подсветка, превью по клику, битая метка", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem("projectTreeOpen", "true");
  });
  await page.goto("/");
  const editor = page
    .locator(".tiptap-wrapper [contenteditable='true']")
    .first();
  await expect(editor).toBeEditable({ timeout: 15_000 });

  // Текст с живой меткой (вложение добавим) и битой.
  await editor.click();
  await page.keyboard.type("См. [FILE_1] и сломанный [IMAGE_9].");

  // Прикрепляем текстовый файл — он получит метку FILE_1.
  const fileInput = page.locator('input[type="file"][multiple]').first();
  await fileInput.setInputFiles({
    name: "notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("содержимое заметки"),
  });
  await expect(page.getByText("notes.txt")).toBeVisible();

  // Живая метка подсвечена, битая — с классом is-broken.
  const liveRef = editor.locator('.attachment-ref[data-label="FILE_1"]');
  await expect(liveRef).toBeVisible();
  await expect(liveRef).not.toHaveClass(/is-broken/);
  const brokenRef = editor.locator('.attachment-ref[data-label="IMAGE_9"]');
  await expect(brokenRef).toHaveClass(/is-broken/);

  // Клик по живой метке — превью вложения.
  await liveRef.click();
  const preview = page.getByRole("dialog", { name: /notes\.txt/ });
  await expect(preview).toBeVisible();
  await expect(preview).toContainText("содержимое заметки");
  await page.keyboard.press("Escape");

  // Клик по битой метке — предупреждение.
  await brokenRef.click();
  await expect(
    page.getByText("Вложение для метки [IMAGE_9] удалено или отсутствует"),
  ).toBeVisible();
});
