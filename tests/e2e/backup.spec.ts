import { test, expect } from "@playwright/test";
import { unlinkSync } from "node:fs";
import { join } from "node:path";

/**
 * Этап 10.1. Бэкап: проект целиком уходит в .tomte.zip и возвращается
 * импортом без потерь. Круг проверяем по уникальному тексту в редакторе.
 */

test("бэкап: экспорт → импорт → содержимое на месте", async ({ page }) => {
  const marker = "МАРКЕР-БЭКАПА-42";
  const projectName = "E2E-бэкап";

  await page.goto("/");
  const editor = page
    .locator(".tiptap-wrapper [contenteditable='true']")
    .first();
  await expect(editor).toBeEditable({ timeout: 15_000 });

  // 1. Новый проект с уникальным именем.
  await page.getByRole("button", { name: "Открыть менеджер проектов" }).click();
  await page.getByRole("button", { name: "Новый проект" }).click();
  await page.getByLabel("Имя нового проекта").fill(projectName);
  await page.getByRole("button", { name: "Создать", exact: true }).click();
  await page.getByRole("button", { name: "Закрыть менеджер проектов" }).click();
  await expect(
    page.getByRole("dialog", { name: "Менеджер проектов" }),
  ).toBeHidden();

  // 2. Уникальный текст в редакторе.
  await editor.click();
  await page.keyboard.type(marker);

  // 3. Экспорт бэкапа.
  await page.getByRole("button", { name: "Открыть менеджер проектов" }).click();
  const downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Скачать бэкап проекта" })
    .first()
    .click();
  const download = await downloadPromise;
  const zipPath = join("test-results", `e2e-backup-${Date.now()}.tomte.zip`);
  await download.saveAs(zipPath);

  // 4. Переименовываем источник, чтобы отличить его от будущего импорта.
  await page
    .getByRole("button", { name: `Переименовать проект ${projectName}` })
    .click();
  const renameInput = page
    .getByRole("dialog", { name: "Менеджер проектов" })
    .locator("input:visible")
    .last();
  await renameInput.fill(`${projectName}-источник`);
  await renameInput.press("Enter");
  const manager = page.getByRole("dialog", { name: "Менеджер проектов" });
  await expect(manager.getByText(`${projectName}-источник`)).toBeVisible();

  // 5. Импорт бэкапа из скачанного архива.
  await page
    .locator('input[type="file"][accept*="zip"]')
    .setInputFiles(zipPath);
  await expect(page.getByText(/импортирован/i)).toBeVisible();
  await expect(manager.getByText(projectName, { exact: true })).toBeVisible();

  // 6. Открываем импортированный проект — текст промпта на месте.
  await manager.getByText(projectName, { exact: true }).click();
  await expect(editor).toContainText(marker);

  unlinkSync(zipPath);
});
