import { test, expect, type Browser, type Page } from "@playwright/test";

/**
 * Этап 5.8. Обучающий тур: подсказки у реальных элементов, шаги-действия.
 * Контекст теста — без флага onboarded (глобальный storageState перекрыт).
 */

async function freshPage(
  browser: Browser,
  viewport = { width: 1440, height: 900 },
) {
  const context = await browser.newContext({
    locale: "ru-RU",
    viewport,
    storageState: { cookies: [], origins: [] },
  });
  const page = await context.newPage();
  await page.goto("/");
  return { context, page };
}

const tourOf = (page: Page) => page.getByRole("dialog", { name: "Обучение" });

/** Подсказка стоит вплотную к цели, а не посреди экрана. */
async function expectNextTo(page: Page, targetSelector: string) {
  const target = await page.locator(targetSelector).boundingBox();
  const popover = await tourOf(page).boundingBox();
  expect(target).not.toBeNull();
  expect(popover).not.toBeNull();
  const gapX = Math.max(
    target!.x - (popover!.x + popover!.width),
    popover!.x - (target!.x + target!.width),
    0,
  );
  const gapY = Math.max(
    target!.y - (popover!.y + popover!.height),
    popover!.y - (target!.y + target!.height),
    0,
  );
  expect(Math.max(gapX, gapY)).toBeLessThan(40);
}

/** Подсветка обводит цель. */
async function expectSpotOn(page: Page, targetSelector: string) {
  await expect
    .poll(async () => {
      const target = await page.locator(targetSelector).boundingBox();
      const spot = await page.locator(".tour-spot").boundingBox();
      if (!target || !spot) return false;
      return (
        spot.x <= target.x &&
        spot.y <= target.y &&
        spot.x + spot.width >= target.x + target.width &&
        spot.y + spot.height >= target.y + target.height
      );
    })
    .toBe(true);
}

test("тур ведёт по интерфейсу и ждёт действий пользователя", async ({
  browser,
}) => {
  const { context, page } = await freshPage(browser);
  const tour = tourOf(page);

  await expect(tour).toBeVisible({ timeout: 15_000 });
  await expect(tour.getByText("Добро пожаловать в Томте")).toBeVisible();
  await tour.getByRole("button", { name: "Далее" }).click();

  // Шаг-действие: подсветка на «+», метка «Нажмите сюда», «Далее» нет.
  await expect(
    tour.getByRole("heading", { name: "Новый промпт" }),
  ).toBeVisible();
  await expectSpotOn(page, '[data-tour="new-prompt"]');
  await expectNextTo(page, '[data-tour="new-prompt"]');
  await expect(page.locator(".tour-badge")).toHaveText("Нажмите сюда");
  await expect(tour.getByRole("button", { name: "Далее" })).toHaveCount(0);

  // Клик по настоящей кнопке сквозь «окно» создаёт файл и двигает тур.
  await page.locator('[data-tour="new-prompt"]').click();
  await expect(tour.getByRole("heading", { name: "Редактор" })).toBeVisible();
  await expect(page.getByRole("tab", { name: /prompt-1/ })).toBeVisible();

  // Набор текста: фокус уже в редакторе, «Далее» появляется после ввода.
  await expect(page.locator(".tour-badge")).toHaveText("Пишите здесь");
  await page.keyboard.type("Привет, модель");
  await expect(tour.getByText("Получилось!")).toBeVisible();
  await expect(page.locator('[data-tour="editor"] .ProseMirror')).toContainText(
    "Привет, модель",
  );
  await tour.getByRole("button", { name: "Далее" }).click();

  // Информационные шаги про тулбар, теги, вложения и дерево.
  for (const [title, target] of [
    ["Панель инструментов", "toolbar"],
    ["Теги", "tags"],
    ["Вложения", "attachments"],
    ["Дерево проекта", "tree"],
  ]) {
    await expect(tour.getByRole("heading", { name: title })).toBeVisible();
    await expectSpotOn(page, `[data-tour="${target}"]`);
    await tour.getByRole("button", { name: "Далее" }).click();
  }

  // Клик мимо «окна» не закрывает тур.
  await expect(tour.getByRole("heading", { name: "Токены" })).toBeVisible();
  await page.mouse.click(700, 400);
  await expect(tour).toBeVisible();

  // Счётчик токенов открывает панель, следующая подсказка — у панели.
  await page.locator('[data-tour="tokens"] > button').click();
  await expect(
    tour.getByRole("heading", { name: "Разбивка и модель" }),
  ).toBeVisible();
  await expectSpotOn(page, '[data-tour="tokens-panel"]');
  await tour.getByRole("button", { name: "Далее" }).click();

  // Экспорт: то же с меню форматов.
  await expect(tour.getByRole("heading", { name: "Экспорт" })).toBeVisible();
  await page.locator('[data-tour="export"] > button').click();
  await expect(tour.getByRole("heading", { name: "Форматы" })).toBeVisible();
  await expectSpotOn(page, '[data-tour="export-menu"]');
  await expectNextTo(page, '[data-tour="export-menu"]');
  await tour.getByRole("button", { name: "Далее" }).click();

  await expect(
    tour.getByRole("heading", { name: "Боковая панель" }),
  ).toBeVisible();
  await tour.getByRole("button", { name: "Далее" }).click();

  await expect(tour.getByRole("heading", { name: "Готово" })).toBeVisible();
  await tour.getByRole("button", { name: "Готово" }).click();
  await expect(tour).toBeHidden();

  // Флаг поставлен: после перезагрузки тура нет.
  await page.reload();
  await page.waitForTimeout(1500);
  await expect(tourOf(page)).toBeHidden();
  await context.close();
});

test("«Назад» к выполненному действию не заставляет повторять его", async ({
  browser,
}) => {
  const { context, page } = await freshPage(browser);
  const tour = tourOf(page);

  await expect(tour).toBeVisible({ timeout: 15_000 });
  await tour.getByRole("button", { name: "Далее" }).click();
  await page.locator('[data-tour="new-prompt"]').click();
  await expect(tour.getByRole("heading", { name: "Редактор" })).toBeVisible();

  await tour.getByRole("button", { name: "Назад" }).click();
  await expect(
    tour.getByRole("heading", { name: "Новый промпт" }),
  ).toBeVisible();
  await expect(tour.getByText("Получилось!")).toBeVisible();
  await expect(page.locator(".tour-badge")).toHaveCount(0);
  await tour.getByRole("button", { name: "Далее" }).click();
  await expect(tour.getByRole("heading", { name: "Редактор" })).toBeVisible();
  await context.close();
});

test("шаг-действие можно пропустить", async ({ browser }) => {
  const { context, page } = await freshPage(browser);
  const tour = tourOf(page);

  await expect(tour).toBeVisible({ timeout: 15_000 });
  await tour.getByRole("button", { name: "Далее" }).click();
  await tour.getByRole("button", { name: "Пропустить шаг" }).click();
  await expect(tour.getByRole("heading", { name: "Редактор" })).toBeVisible();
  await context.close();
});

test("тур перезапускается из шпаргалки и пропускается", async ({ browser }) => {
  const { context, page } = await freshPage(browser);
  const tour = tourOf(page);

  // Пропуск тоже ставит флаг.
  await expect(tour).toBeVisible({ timeout: 15_000 });
  await tour.getByRole("button", { name: "Пропустить" }).click();
  await expect(tour).toBeHidden();

  // Перезапуск из шпаргалки («?»).
  await page.keyboard.press("?");
  const shortcuts = page.getByRole("dialog", { name: "Горячие клавиши" });
  await expect(shortcuts).toBeVisible();
  await shortcuts.getByRole("button", { name: "Показать обучение" }).click();

  await expect(tour).toBeVisible();
  await expect(tour.getByText("Добро пожаловать в Томте")).toBeVisible();

  // Escape закрывает тур.
  await page.keyboard.press("Escape");
  await expect(tour).toBeHidden();
  await context.close();
});

test("прошедшим первую версию тура новый показывается снова", async ({
  browser,
}) => {
  const context = await browser.newContext({
    locale: "ru-RU",
    storageState: {
      cookies: [],
      origins: [
        {
          origin: "http://localhost:5173",
          localStorage: [{ name: "tomte:onboarded", value: "1" }],
        },
      ],
    },
  });
  const page = await context.newPage();
  await page.goto("/");
  await expect(tourOf(page)).toBeVisible({ timeout: 15_000 });
  await context.close();
});

test("на телефоне подсказка — шторка, панель выезжает сама", async ({
  browser,
}) => {
  const { context, page } = await freshPage(browser, {
    width: 390,
    height: 844,
  });
  const tour = tourOf(page);

  await expect(tour).toBeVisible({ timeout: 15_000 });
  await tour.getByRole("button", { name: "Далее" }).click();

  // Кнопка «+» живёт в выезжающей панели: тур открывает её сам.
  await expectSpotOn(page, '[data-tour="new-prompt"]');
  const box = await tour.boundingBox();
  expect(box!.x).toBeCloseTo(12, 0);
  expect(box!.width).toBeCloseTo(390 - 24, 0);

  await page.locator('[data-tour="new-prompt"]').click();
  await expect(tour.getByRole("heading", { name: "Редактор" })).toBeVisible();
  // Для шага про редактор панель закрывается.
  await expectSpotOn(page, '[data-tour="editor"]');

  // Шага про боковую панель (её нет на телефоне) в счётчике нет.
  await expect(tour.getByText("Шаг 3 из 12")).toBeVisible();
  await context.close();
});
