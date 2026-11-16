import { test, expect, type Page } from "@playwright/test";

/**
 * Этап 13.1. Все модалки на общем каркасе ModalShell: Escape закрывает
 * только верхнюю, Tab не уходит из модалки, клавиатура внутри работает.
 */

async function openApp(page: Page) {
  await page.goto("/");
  await expect(page.locator(".tiptap-prose")).toBeEditable({
    timeout: 15_000,
  });
}

async function openExtractor(page: Page) {
  await page.getByRole("button", { name: "Открыть экстрактор кода" }).click();
  return page.getByRole("dialog", { name: "Экстрактор кода" });
}

test("в экстракторе печатаются пробелы и переносы строк", async ({ page }) => {
  // Раньше панель модалки гасила Enter и пробел для всего содержимого.
  await openApp(page);
  const extractor = await openExtractor(page);
  const input = extractor.getByRole("textbox", {
    name: "Ответ LLM в формате Markdown",
  });
  await input.click();
  await page.keyboard.type("a b");
  await page.keyboard.press("Enter");
  await page.keyboard.type("c");
  await expect(input).toHaveValue("a b\nc");
});

test("Escape закрывает только верхнюю модалку", async ({ page }) => {
  await openApp(page);
  const extractor = await openExtractor(page);
  await extractor
    .getByRole("textbox", { name: "Ответ LLM в формате Markdown" })
    .fill("```ts\n// main.ts\nexport const x = 1;\n```");
  await extractor.getByRole("button", { name: "Распознать файлы" }).click();
  await extractor.getByRole("button", { name: "Просмотр" }).first().click();

  const preview = page.getByRole("dialog", { name: /Предпросмотр файла/ });
  await expect(preview).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(preview).toBeHidden();
  await expect(extractor).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(extractor).toBeHidden();
});

test("Tab не уходит из модалки", async ({ page }) => {
  await openApp(page);
  await page.keyboard.press("?");
  const dialog = page.getByRole("dialog", { name: "Горячие клавиши" });
  await expect(dialog).toBeVisible();

  for (let i = 0; i < 12; i++) {
    await page.keyboard.press(i % 3 === 2 ? "Shift+Tab" : "Tab");
    const inside = await dialog.evaluate((el) =>
      el.contains(document.activeElement),
    );
    expect(inside).toBe(true);
  }
});

test("подтверждение проходится с клавиатуры, фокус сначала на «Отмене»", async ({
  page,
}) => {
  await openApp(page);
  await page.locator(".tiptap-prose").click();
  await page.keyboard.type("Текст");

  await page.getByRole("button", { name: "Очистить весь текст" }).click();
  const confirm = page.getByRole("alertdialog", {
    name: "Очистить весь текст?",
  });
  await expect(confirm).toBeVisible();
  await expect(confirm.getByRole("button", { name: "Отмена" })).toBeFocused();

  // Tab на кнопку подтверждения, Enter — действие выполняется.
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await expect(confirm).toBeHidden();
  await expect(page.locator(".tiptap-prose")).not.toContainText("Текст");
});

test("Escape в поле нового проекта отменяет создание, менеджер остаётся", async ({
  page,
}) => {
  await openApp(page);
  await page
    .getByRole("button", { name: "Открыть менеджер проектов" })
    .first()
    .click();
  const manager = page.getByRole("dialog", { name: "Менеджер проектов" });
  await manager.getByRole("button", { name: "Новый проект" }).click();
  const name = manager.getByLabel("Имя нового проекта");
  await expect(name).toBeVisible();

  await name.press("Escape");
  await expect(name).toBeHidden();
  await expect(manager).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(manager).toBeHidden();
});
