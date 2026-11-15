import { test, expect } from "@playwright/test";

/**
 * Этап 10.5. Экстрактор с записью на диск: извлечённые файлы уходят
 * в выбранную папку через File System Access API. Папка в тесте —
 * in-memory заглушка showDirectoryPicker.
 */

const MARKDOWN = `Результат агента:

**src/a.ts**
\`\`\`ts
export const a = 1;
\`\`\`

**src/b.ts**
\`\`\`ts
export const b = 2;
\`\`\`
`;

test("экстрактор: запись файлов в папку с планом изменений", async ({
  page,
}) => {
  // In-memory папка: b.ts уже существует с другим содержимым.
  await page.addInitScript(() => {
    class StubFile {
      content: string;
      constructor(content = "") {
        this.content = content;
      }
      async getFile() {
        return new File([this.content], "stub");
      }
      createWritable = async () => ({
        write: async (data: string) => {
          this.content = String(data);
        },
        close: async () => {},
        abort: async () => {},
      });
    }
    class StubDir {
      name: string;
      dirs: Record<string, StubDir> = {};
      files: Record<string, StubFile> = {};
      constructor(name = "demo") {
        this.name = name;
      }
      async getDirectoryHandle(name: string, opts?: { create?: boolean }) {
        if (!this.dirs[name]) {
          if (!opts?.create) throw new DOMException("nf", "NotFoundError");
          this.dirs[name] = new StubDir(name);
        }
        return this.dirs[name];
      }
      async getFileHandle(name: string, opts?: { create?: boolean }) {
        if (!this.files[name]) {
          if (!opts?.create) throw new DOMException("nf", "NotFoundError");
          this.files[name] = new StubFile();
        }
        return this.files[name];
      }
    }
    const root = new StubDir("demo");
    const src = new StubDir("src");
    src.files["b.ts"] = new StubFile("export const b = 1;");
    root.dirs["src"] = src;
    (window as unknown as { __stubRoot: StubDir }).__stubRoot = root;
    window.showDirectoryPicker = async () =>
      root as unknown as FileSystemDirectoryHandle;
  });

  await page.goto("/");
  const editor = page
    .locator(".tiptap-wrapper [contenteditable='true']")
    .first();
  await expect(editor).toBeEditable({ timeout: 15_000 });

  await page.getByRole("button", { name: "Открыть меню инструментов" }).click();
  await page.getByRole("menuitem", { name: "Экстрактор кода" }).click();

  const dialog = page.getByRole("dialog", { name: "Экстрактор кода" });
  await expect(dialog).toBeVisible();
  await dialog.locator("textarea").first().fill(MARKDOWN);
  await dialog.getByRole("button", { name: "Распознать файлы" }).click();

  // Запись в папку: план — a.ts новый, b.ts изменённый.
  await dialog.getByRole("button", { name: "Записать в папку…" }).click();
  const plan = page.getByRole("dialog", {
    name: "Запись извлечённых файлов в папку",
  });
  await expect(plan).toBeVisible();
  await expect(plan.getByText("src/a.ts").first()).toBeVisible();
  await expect(plan.getByText("src/b.ts").first()).toBeVisible();
  await expect(plan.getByText("новый").first()).toBeVisible();
  await expect(plan.getByText(/\+\d+ \/ −\d+/)).toBeVisible();

  await plan.getByRole("button", { name: /Записать \d+/ }).click();
  await expect(page.getByText(/Записано файлов: \d+/)).toBeVisible();

  // Папка-заглушка получила оба файла с новым содержимым.
  const written = await page.evaluate(async () => {
    const root = (window as unknown as { __stubRoot: any }).__stubRoot;
    const src = await root.getDirectoryHandle("src");
    const a = await (await src.getFileHandle("a.ts")).getFile();
    const b = await (await src.getFileHandle("b.ts")).getFile();
    return { a: await a.text(), b: await b.text() };
  });
  expect(written.a).toBe("export const a = 1;");
  expect(written.b).toBe("export const b = 2;");
});
