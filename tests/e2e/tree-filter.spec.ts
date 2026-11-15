import { test, expect } from "@playwright/test";

/**
 * Этап 10.6. Фильтры выбора файлов: .gitignore по умолчанию, пресеты
 * через поповер. Отсеянные файлы приглушены, их чекбоксы выключены,
 * «выбрать все» их не берёт.
 */

test("фильтр: .gitignore по умолчанию, пресет «только src»", async ({
  page,
}) => {
  // Сайдбар по умолчанию свёрнут: открываем, чтобы клики долетали.
  await page.addInitScript(() => {
    localStorage.setItem("projectTreeOpen", "true");
  });
  await page.goto("/");
  await page.waitForTimeout(1500);

  await page.evaluate(async () => {
    const actionsPath = "/src/utils/projectActions.ts";
    const { setProjectTreeSource } = await import(
      /* @vite-ignore */ actionsPath
    );
    const file = (name: string, text: string) => new File([text], name);
    await setProjectTreeSource({
      rootName: "demo",
      fileCount: 4,
      nodes: [
        {
          name: "src",
          path: "src",
          type: "directory",
          children: [
            {
              name: "index.ts",
              path: "src/index.ts",
              type: "file",
              children: [],
              fileRef: file("index.ts", "export const x = 1;"),
            },
          ],
        },
        {
          name: "node_modules",
          path: "node_modules",
          type: "directory",
          children: [
            {
              name: "dep",
              path: "node_modules/dep",
              type: "directory",
              children: [
                {
                  name: "index.js",
                  path: "node_modules/dep/index.js",
                  type: "file",
                  children: [],
                  fileRef: file("index.js", "module.exports = 1;"),
                },
              ],
            },
          ],
        },
        {
          name: ".gitignore",
          path: ".gitignore",
          type: "file",
          children: [],
          fileRef: file(".gitignore", "node_modules/\n*.log"),
        },
        {
          name: "debug.log",
          path: "debug.log",
          type: "file",
          children: [],
          fileRef: file("debug.log", "log line"),
        },
      ],
    });
  });

  // .gitignore учитывается по умолчанию: node_modules и *.log отсеяны.
  await expect(
    page.getByRole("checkbox", { name: "Выбрать index.js" }),
  ).toBeDisabled();
  await expect(
    page.getByRole("checkbox", { name: "Выбрать debug.log" }),
  ).toBeDisabled();
  await expect(
    page.getByRole("checkbox", { name: "Выбрать index.ts" }),
  ).toBeEnabled();

  // Пресет «только src/»: .gitignore тоже уходит.
  await page.getByRole("button", { name: "Фильтр выбора файлов" }).click();
  await page
    .getByRole("dialog", { name: "Фильтры файлов" })
    .getByText("Только src/")
    .click();
  await expect(
    page.getByRole("checkbox", { name: "Выбрать .gitignore" }),
  ).toBeDisabled();
  await expect(
    page.getByRole("checkbox", { name: "Выбрать index.ts" }),
  ).toBeEnabled();

  // «Выбрать все» берёт только проходящие фильтр файлы.
  // Кликаем обёртку: сам input визуально скрыт, поверх лежит .checkbox-visual.
  await page
    .getByRole("checkbox", { name: "Выбрать все" })
    .locator("xpath=..")
    .click();
  await expect(
    page.getByRole("checkbox", { name: "Выбрать index.ts" }),
  ).toBeChecked();
  await expect(
    page.getByRole("checkbox", { name: "Выбрать index.js" }),
  ).not.toBeChecked();
});
