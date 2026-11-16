import { test, expect } from "@playwright/test";

test.describe("Редактор", () => {
  test("можно ввести текст в редактор", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("region", { name: "Область редактора" }),
    ).toBeVisible({ timeout: 15_000 });

    const editor = page.locator(".tiptap-prose");

    await expect(editor).toBeEditable({ timeout: 15_000 });

    await editor.click();
    await page.keyboard.type("Привет, мир!");

    await expect(editor).toContainText("Привет, мир!");

    // "Привет, мир!" — 12 символов.
    await expect(page.getByText("12 символов")).toBeVisible();
  });

  test("плейсхолдер не сдвигает каретку и текст вправо", async ({ page }) => {
    await page.goto("/");
    const editor = page.locator(".tiptap-prose");
    await expect(editor).toBeEditable({ timeout: 15_000 });
    await editor.click();

    // В пустом абзаце каретка стоит на служебном <br>: он должен быть
    // в начале строки, а не за плейсхолдером. Сам плейсхолдер — абсолютный
    // блок вне раскладки строки (float уводил каретку вправо в Firefox).
    const layout = await page.evaluate(() => {
      const para = document.querySelector(".tiptap-prose p")!;
      const br = para.querySelector("br")!;
      const before = getComputedStyle(para, "::before");
      return {
        paraX: para.getBoundingClientRect().x,
        caretX: br.getBoundingClientRect().x,
        position: before.position,
        float: before.cssFloat,
      };
    });
    expect(layout.caretX).toBeCloseTo(layout.paraX, 0);
    expect(layout.position).toBe("absolute");
    expect(layout.float).toBe("none");

    await page.keyboard.type("Слева");
    const text = page.locator(".tiptap-prose p").first();
    const box = await text.boundingBox();
    expect(box!.x).toBeCloseTo(layout.paraX, 0);
  });

  test("можно создать новый файл промпта через табы", async ({ page }) => {
    await page.goto("/");

    const tablist = page.getByRole("tablist", {
      name: "Файлы промптов",
    });

    // Ждём загрузки проекта: tablist виден сразу после SSR,
    // но кнопки оживают только после гидрации и загрузки проекта.
    await expect(
      tablist.getByRole("tab", { name: "Вкладка main" }),
    ).toBeVisible({ timeout: 15_000 });

    const createButton = tablist.getByRole("button", {
      name: "Создать новый файл промпта",
    });
    await createButton.click();

    const nameInput = page.locator('input[placeholder="Имя файла..."]');
    await expect(nameInput).toBeVisible({ timeout: 10_000 });

    await nameInput.fill("test-prompt.md");
    await nameInput.press("Enter");

    await expect(
      page.getByRole("tab", { name: /test-prompt\.md/ }),
    ).toBeVisible();
  });

  test("форматирование текста работает", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("region", { name: "Область редактора" }),
    ).toBeVisible({ timeout: 15_000 });

    const editor = page.locator(".tiptap-prose");

    await expect(editor).toBeEditable({ timeout: 15_000 });

    await editor.click();

    await page.keyboard.type("Жирный текст");
    await page.keyboard.press("Control+A");

    await page.getByRole("button", { name: "Жирный" }).click();

    await expect(editor.locator("strong")).toContainText("Жирный текст");
  });
});
