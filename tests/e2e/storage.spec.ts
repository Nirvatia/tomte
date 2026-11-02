import { test, expect, type Page } from "@playwright/test";

async function waitForEditor(page: Page) {
  await expect(
    page.getByRole("tab", { name: /^Вкладка / }).first(),
  ).toBeVisible({ timeout: 15_000 });
  return page.locator(".tiptap-prose");
}

test.describe("Хранение", () => {
  test("текст переживает перезагрузку страницы", async ({ page }) => {
    await page.goto("/");
    const editor = await waitForEditor(page);

    await editor.click();
    await page.keyboard.type("Не потеряй меня");
    await expect(page.getByText("Сохранено")).toBeVisible({ timeout: 10_000 });

    await page.reload();
    await waitForEditor(page);
    await expect(page.locator(".tiptap-prose")).toContainText("Не потеряй меня");
  });

  test("переключение файлов сразу после набора не теряет текст", async ({ page }) => {
    await page.goto("/");
    const editor = await waitForEditor(page);
    const tablist = page.getByRole("tablist", { name: "Файлы промптов" });

    await tablist.getByRole("button", { name: "Создать новый файл промпта" }).click();
    const nameInput = page.locator('input[placeholder="Имя файла..."]');
    await nameInput.fill("second");
    await nameInput.press("Enter");
    await expect(tablist.getByRole("tab", { name: "Вкладка second" })).toBeVisible();

    // Печатаем во втором файле и сразу, не дожидаясь автосохранения, уходим в первый.
    await editor.click();
    await page.keyboard.type("Текст второго файла");
    await tablist.getByRole("tab", { name: "Вкладка main" }).click();
    await tablist.getByRole("tab", { name: "Вкладка second" }).click();

    await expect(editor).toContainText("Текст второго файла");
    await page.reload();
    await waitForEditor(page);
    // После перезагрузки открывается первый файл проекта; второй открываем из панели.
    const resizer = page.getByRole("button", { name: "Изменить ширину панели" });
    if (!(await resizer.isVisible())) {
      await page.getByRole("button", { name: "Открыть панель структуры проекта" }).click();
    }
    await page
      .getByRole("complementary")
      .getByRole("button", { name: "second", exact: true })
      .click();
    await expect(page.locator(".tiptap-prose")).toContainText("Текст второго файла");
  });

  test("база старого формата (v1) открывается без потерь", async ({ page }) => {
    // Страница того же origin, на которой приложение ещё не открыло базу.
    await page.goto("/robots.txt");
    await page.evaluate(async () => {
      const now = new Date().toISOString();
      const ref = { owner: "me", repo: "repo", branch: "main", token: "ghp_secret" };
      const project = {
        id: "legacy",
        name: "Legacy Project",
        files: [{ id: "f1", name: "main", content: "<p>старый текст</p>", createdAt: now, updatedAt: now }],
        attachments: [{ id: "a1", name: "note.txt", size: 4, type: "text", content: "note", ext: "txt" }],
        projectTreeSource: {
          rootName: "repo",
          fileCount: 1,
          nodes: [{ name: "a.ts", path: "a.ts", type: "file", children: [], githubRef: ref }],
        },
        githubConfig: ref,
        totalSize: 1,
        createdAt: now,
        updatedAt: now,
      };
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.open("tomte-projects-db", 1);
        request.onupgradeneeded = () =>
          request.result.createObjectStore("projects", { keyPath: "id" });
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const tx = request.result.transaction("projects", "readwrite");
          tx.objectStore("projects").put(project);
          tx.oncomplete = () => {
            request.result.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      });
    });

    await page.goto("/");
    await waitForEditor(page);
    await expect(page.locator(".tiptap-prose")).toContainText("старый текст");

    const stored = await page.evaluate(async () => {
      const db = await new Promise<IDBDatabase>((resolve) => {
        const request = indexedDB.open("tomte-projects-db");
        request.onsuccess = () => resolve(request.result);
      });
      const getAll = (store: string) =>
        new Promise<unknown[]>((resolve) => {
          const request = db.transaction(store).objectStore(store).getAll();
          request.onsuccess = () => resolve(request.result);
        });
      return {
        version: db.version,
        attachments: await getAll("attachments"),
        trees: JSON.stringify(await getAll("trees")),
      };
    });

    expect(stored.version).toBe(2);
    expect(stored.attachments).toHaveLength(1);
    expect(stored.trees).toContain("a.ts");
    expect(stored.trees).not.toContain("ghp_secret");
  });
});
