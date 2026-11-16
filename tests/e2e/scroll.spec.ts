import { test, expect, type Page } from "@playwright/test";

/**
 * Длинный контент не должен раздувать раскладку: строка состояния остаётся
 * в окне, редактор, дерево и панель тегов прокручиваются сами. Раньше
 * колонка приложения (overflow-clip без min-h-0) росла вместе с текстом и
 * уводила строку состояния за экран.
 */

test.use({ viewport: { width: 1440, height: 800 } });

async function openApp(page: Page) {
  await page.goto("/");
  await expect(page.locator(".tiptap-prose")).toBeEditable({
    timeout: 15_000,
  });
}

/** Нижняя граница элемента не ниже окна — значит, его раздуло. */
async function bottomOf(page: Page, selector: string) {
  return page
    .locator(selector)
    .first()
    .evaluate((el) => el.getBoundingClientRect().bottom);
}

test("длинный текст прокручивается в редакторе, строка состояния на месте", async ({
  page,
}) => {
  await openApp(page);
  await page.locator(".tiptap-prose").click();
  await page.keyboard.insertText(
    Array.from({ length: 200 }, (_, i) => `Строка ${i}`).join("\n"),
  );

  expect(await bottomOf(page, ".app-main")).toBeLessThanOrEqual(800);
  const status = page.getByText("0 вложений");
  await expect(status).toBeInViewport();

  const scroller = page.locator('[data-tour="editor"] > div').first();
  const scrollable = await scroller.evaluate(
    (el) => el.scrollHeight > el.clientHeight,
  );
  expect(scrollable).toBe(true);
});

test("длинный список промптов прокручивается в сайдбаре", async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem("projectTreeOpen", "true"),
  );
  await openApp(page);
  for (let i = 0; i < 40; i++) {
    await page.locator('[data-tour="new-prompt"]').click();
  }

  expect(await bottomOf(page, ".app-main")).toBeLessThanOrEqual(800);
  await expect(page.getByText("0 вложений")).toBeInViewport();

  const list = page.locator("aside .overflow-y-auto").first();
  const scrollable = await list.evaluate(
    (el) => el.scrollHeight > el.clientHeight,
  );
  expect(scrollable).toBe(true);
});

test("много тегов не вытесняют редактор", async ({ page }) => {
  await page.addInitScript(() => {
    const tags = Array.from({ length: 60 }, (_, i) => ({
      id: `t${i}`,
      name: `Тег номер ${i}`,
      value: `v${i}`,
    }));
    localStorage.setItem("tomte_tags_v1", JSON.stringify(tags));
  });
  await openApp(page);

  const editorHeight = await page
    .locator('[data-tour="editor"]')
    .evaluate((el) => el.getBoundingClientRect().height);
  expect(editorHeight).toBeGreaterThan(300);

  const tags = page.locator('[data-tour="tags"]');
  const scrollable = await tags.evaluate(
    (el) => el.scrollHeight > el.clientHeight,
  );
  expect(scrollable).toBe(true);
  await expect(page.getByText("0 вложений")).toBeInViewport();
});
