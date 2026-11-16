import { test, expect, type Page } from "@playwright/test";

/**
 * Этап 9. Адаптив: одно приложение на трёх ширинах.
 * Десктоп (≥1024px): сайдбар в ряду, ресайз, activity bar.
 * Планшет и телефон (<1024px): сайдбар выезжает поверх редактора,
 * тулбар ужимается, activity bar спрятан (проекты — из шапки).
 */

async function waitApp(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("main")).toBeVisible({ timeout: 15_000 });
  await expect(
    page.locator(".tiptap-wrapper, [contenteditable='true']").first(),
  ).toBeVisible({ timeout: 15_000 });
}

async function seedSidebarOpen(page: Page, open: boolean) {
  await page.addInitScript((value) => {
    localStorage.setItem("projectTreeOpen", value);
  }, String(open));
}

test.describe("Десктоп (1440px)", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("сайдбар в ряду, панель видна", async ({ page }) => {
    await seedSidebarOpen(page, true);
    await waitApp(page);

    const sidebar = page.getByRole("complementary");
    await expect(sidebar).toBeVisible();
    // Ручка ресайза есть только в рядовом режиме.
    await expect(sidebar.getByRole("button", { name: /ширин/i })).toBeVisible();
    // Activity bar слева.
    await expect(
      page.getByRole("button", { name: "Открыть менеджер проектов" }),
    ).toBeVisible();
    // Полный тулбар: заголовки и копирование на виду.
    await expect(
      page.getByRole("button", { name: "Заголовок 1" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Копировать текст" }),
    ).toBeVisible();
  });
});

test.describe("Планшет (834px)", () => {
  test.use({ viewport: { width: 834, height: 1112 } });

  test("сайдбар выезжает поверх и закрывается после выбора файла", async ({
    page,
  }) => {
    await seedSidebarOpen(page, false);
    await waitApp(page);

    // Закрыт: оверлея нет, редактор занимает ширину.
    await expect(page.getByRole("complementary")).toBeHidden();

    await page
      .getByRole("button", { name: "Открыть панель структуры проекта" })
      .click();
    const sidebar = page.getByRole("complementary");
    await expect(sidebar).toBeVisible();
    // Крестик закрытия есть только в оверлее.
    await sidebar.getByRole("button", { name: "Закрыть" }).click();
    await expect(sidebar).toBeHidden();

    // Снова открыли и выбрали файл — оверлей закрылся сам.
    await page
      .getByRole("button", { name: "Открыть панель структуры проекта" })
      .click();
    await sidebar.getByRole("button", { name: "main", exact: true }).click();
    await expect(sidebar).toBeHidden();
  });

  test("тулбар ужат: заголовков нет, основные кнопки на месте", async ({
    page,
  }) => {
    await seedSidebarOpen(page, false);
    await waitApp(page);

    await expect(
      page.getByRole("button", { name: "Заголовок 1" }),
    ).toBeHidden();
    await expect(page.getByRole("button", { name: "Жирный" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Копировать текст" }),
    ).toBeHidden();
  });
});

test.describe("Телефон (390px)", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("лайт-версия: проекты из шапки, activity bar спрятан", async ({
    page,
  }) => {
    await seedSidebarOpen(page, false);
    await waitApp(page);

    // Кнопка проектов одна — в шапке (activity bar спрятан).
    const projects = page.getByRole("button", {
      name: "Открыть менеджер проектов",
    });
    await expect(projects).toBeVisible();
    await expect(projects).toHaveCount(1);
    // Activity bar: рядом нет кнопки карты кода (её пункт вообще недоступен).
    await expect(
      page.getByRole("button", { name: "Открыть генератор карты кода" }),
    ).toBeHidden();

    // Экспорт доступен, статусбар показывает токены без имени проекта.
    await expect(page.getByRole("button", { name: "Экспорт" })).toBeVisible();
    await expect(page.getByText("Проект без названия")).toBeHidden();
    await expect(page.getByRole("button", { name: /≈/ })).toBeVisible();
  });

  test("тулбар минимален, копирование — в меню «ещё»", async ({ page }) => {
    await seedSidebarOpen(page, false);
    await waitApp(page);

    await expect(page.getByRole("button", { name: "Жирный" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Заголовок 1" }),
    ).toBeHidden();
    await expect(
      page.getByRole("button", { name: "Копировать текст" }),
    ).toBeHidden();

    await page
      .getByRole("button", { name: "Открыть меню инструментов" })
      .click();
    await expect(
      page.getByRole("menuitem", { name: "Копировать текст" }),
    ).toBeVisible();
  });
});

test.describe("Телефон: высота окна", () => {
  // Сенсорный экран: высоту даёт visualViewport (адресная строка, клавиатура).
  test.use({
    viewport: { width: 390, height: 664 },
    isMobile: true,
    hasTouch: true,
  });

  const box = (page: Page, selector: string) =>
    page.locator(selector).first().boundingBox();

  test("приложение вписано в видимую часть окна", async ({ page }) => {
    await waitApp(page);
    const root = await box(page, ".app-root");
    expect(root!.height).toBeCloseTo(664, 0);
    expect((await box(page, "header"))!.y).toBe(0);
    const status = await box(page, '[data-tour="tokens"]');
    expect(status!.y + status!.height).toBeLessThanOrEqual(664);
  });

  test("видимая часть сжалась (клавиатура) — шапка и статусбар на месте", async ({
    page,
  }) => {
    await waitApp(page);
    await page.setViewportSize({ width: 390, height: 420 });
    await expect
      .poll(async () => (await box(page, ".app-root"))!.height)
      .toBeCloseTo(420, 0);
    expect((await box(page, "header"))!.y).toBe(0);
    const status = await box(page, '[data-tour="tokens"]');
    expect(status!.y + status!.height).toBeLessThanOrEqual(420);
  });

  test("низкий экран: интерфейс прокручивается, а не обрезается", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 844, height: 340 });
    await waitApp(page);
    const root = page.locator(".app-root");
    const overflow = await root.evaluate(
      (el) => el.scrollHeight - el.clientHeight,
    );
    expect(overflow).toBeGreaterThan(0);
    await root.evaluate((el) => el.scrollTo(0, el.scrollHeight));
    const status = await box(page, '[data-tour="tokens"]');
    expect(status!.y + status!.height).toBeLessThanOrEqual(340);
  });
});
