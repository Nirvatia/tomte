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
      sidebar.getByRole("button", { name: /^Промпты/ }),
    ).toBeVisible();

    await expect(
      sidebar.getByRole("button", { name: /^Вложения/ }),
    ).toBeVisible();

    await expect(
      sidebar.getByRole("button", { name: /^Проект/ }),
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
      sidebar.getByRole("button", { name: /^Промпты/ }),
    ).toBeVisible();

    // Ищем файл только внутри сайдбара и только точным совпадением.
    // Иначе можно зацепить вкладку или строку статуса редактора.
    await expect(
      sidebar.getByRole("button", { name: "main", exact: true }),
    ).toBeVisible();
  });
});

test("дерево проекта удаляется отдельной кнопкой с подтверждением", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem("projectTreeOpen", "true");
  });
  await page.goto("/");
  await expect(page.locator(".tiptap-prose")).toBeEditable({
    timeout: 15_000,
  });

  await page.evaluate(async () => {
    const actionsPath = "/src/utils/projectActions.ts";
    const { setProjectTreeSource } = await import(
      /* @vite-ignore */ actionsPath
    );
    return setProjectTreeSource({
      rootName: "demo",
      fileCount: 1,
      nodes: [
        {
          name: "a.ts",
          path: "a.ts",
          type: "file",
          children: [],
          fileRef: new File(["x"], "a.ts"),
        },
      ],
    });
  });

  const sidebar = page.getByRole("complementary");
  await expect(sidebar.getByText("demo", { exact: true })).toBeVisible();

  // «Отмена» оставляет дерево на месте.
  await sidebar.getByRole("button", { name: "Удалить дерево проекта" }).click();
  const confirm = page.getByRole("alertdialog", {
    name: "Удалить дерево проекта?",
  });
  await expect(confirm).toBeVisible();
  await confirm.getByRole("button", { name: "Отмена" }).click();
  await expect(sidebar.getByText("demo", { exact: true })).toBeVisible();

  // «Удалить» убирает дерево; текст редактора не затронут.
  await page.locator(".tiptap-prose").click();
  await page.keyboard.type("Текст остаётся");
  await sidebar.getByRole("button", { name: "Удалить дерево проекта" }).click();
  await confirm.getByRole("button", { name: "Удалить" }).click();
  await expect(sidebar.getByText("Дерево не создано")).toBeVisible();
  await expect(page.locator(".tiptap-prose")).toContainText("Текст остаётся");
});

test("файл промпта открывается кликом по любой точке плашки", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem("projectTreeOpen", "true");
  });
  await page.goto("/");
  await expect(page.locator(".tiptap-prose")).toBeEditable({
    timeout: 15_000,
  });

  // Новый промпт становится активным; вернуться на «main» надо кликом по плашке.
  await page.locator('[data-tour="new-prompt"]').click();
  const tabs = page.getByRole("tablist");
  await expect(tabs.getByRole("tab", { name: /prompt-1/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );

  const sidebar = page.getByRole("complementary");
  const label = sidebar.getByRole("button", { name: "main", exact: true });
  // Плашка — строка вокруг кнопки: родитель с отступами и рамкой слева.
  const row = label.locator("xpath=..");
  const box = await row.boundingBox();
  if (!box) throw new Error("плашка не найдена");

  // Низ плашки, самая нижняя пара пикселей: раньше это были пустые отступы.
  for (const [dx, dy] of [
    [box.width / 2, box.height - 2],
    [box.width / 2, 2],
    [14, box.height / 2], // отступ слева от иконки
  ]) {
    await page.mouse.click(box.x + dx, box.y + dy);
    await expect(tabs.getByRole("tab", { name: /main/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    // Снова уходим на другой файл, чтобы проверить следующую точку.
    await tabs.getByRole("tab", { name: /prompt-1/ }).click();
  }
});
