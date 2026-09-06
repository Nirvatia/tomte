import { test, expect, type Page } from "@playwright/test";

const TREE_BUTTON_NAME = "Открыть панель структуры проекта";
const RESIZER_NAME = "Изменить ширину панели";

async function openProjectTree(page: Page) {
  const treeButton = page.getByRole("button", { name: TREE_BUTTON_NAME });
  const resizer = page.getByRole("button", { name: RESIZER_NAME });

  // Панель может быть уже открыта из-за сохранённого состояния,
  // поэтому открываем её только если ресайзера нет.
  if (!(await resizer.isVisible())) {
    await treeButton.click();
  }

  await expect(resizer).toBeVisible({ timeout: 10_000 });

  return { treeButton, resizer };
}

test.describe("Панель проекта", () => {
  test("открывается и закрывается кнопкой в тулбаре", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("region", { name: "Область редактора" }),
    ).toBeVisible({ timeout: 15_000 });

    const { treeButton, resizer } = await openProjectTree(page);

    const sidebar = page.getByRole("complementary");

    // Проверяем секции только внутри сайдбара,
    // чтобы не цепать StatusBar и другие зоны.
    await expect(
      sidebar.getByRole("button", { name: /^Prompts/ }),
    ).toBeVisible();

    await expect(
      sidebar.getByRole("button", { name: /^Attachments/ }),
    ).toBeVisible();

    await expect(
      sidebar.getByRole("button", { name: /^Project/ }),
    ).toBeVisible();

    // Закрываем панель повторным кликом.
    await treeButton.click();

    // Надёжнее проверять исчезновение ресайзера:
    // он рендерится только когда панель открыта.
    await expect(resizer).toBeHidden();
  });

  test("секция Prompts показывает файлы проекта", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("region", { name: "Область редактора" }),
    ).toBeVisible({ timeout: 15_000 });

    await openProjectTree(page);

    const sidebar = page.getByRole("complementary");

    await expect(
      sidebar.getByRole("button", { name: /^Prompts/ }),
    ).toBeVisible();

    // Ищем файл только внутри сайдбара и только точным совпадением.
    // Иначе можно зацепить вкладку или строку статуса редактора.
    await expect(
      sidebar.getByRole("button", { name: "main.md", exact: true }),
    ).toBeVisible();
  });

  test("закрывается по Escape", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("region", { name: "Область редактора" }),
    ).toBeVisible({ timeout: 15_000 });

    const { resizer } = await openProjectTree(page);

    await page.keyboard.press("Escape");

    // Проверяем закрытие по исчезновению ресайзера,
    // а не по тексту Explorer.
    await expect(resizer).toBeHidden();
  });
});