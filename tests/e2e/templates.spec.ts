import { test, expect } from "@playwright/test";
import { readFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";

/**
 * Этап 10.2. Шаблоны: {{task}} в тексте промпта → форма перед экспортом →
 * значение попадает в скачанный файл, сама переменная исчезает.
 */

test("переменная шаблона подставляется в Markdown-экспорт", async ({
  page,
}) => {
  const value = "ПЕРЕВЕСТИ-README-НА-РУССКИЙ";

  await page.goto("/");
  const editor = page
    .locator(".tiptap-wrapper [contenteditable='true']")
    .first();
  await expect(editor).toBeEditable({ timeout: 15_000 });

  await editor.click();
  await page.keyboard.type("Задача: {{task}}. Язык: {{lang}}.");

  // Экспорт → Markdown: сначала форма переменных.
  await page.getByRole("button", { name: "Экспорт" }).click();
  await page.getByRole("menuitem", { name: "Markdown" }).click();
  const dialog = page.getByRole("dialog", { name: "Переменные шаблона" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("{{task}}")).toBeVisible();
  await expect(dialog.getByText("{{lang}}")).toBeVisible();

  // Заполняем task, lang оставляем пустой: она должна остаться как есть.
  await dialog.locator("input").first().fill(value);
  const downloadPromise = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "Экспортировать" }).click();

  const download = await downloadPromise;
  const mdPath = join("test-results", `e2e-template-${Date.now()}.md`);
  await download.saveAs(mdPath);

  const md = readFileSync(mdPath, "utf8");
  expect(md).toContain(value);
  expect(md).not.toContain("{{task}}");
  expect(md).toContain("{{lang}}");

  unlinkSync(mdPath);
});
