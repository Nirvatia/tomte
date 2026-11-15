import { test, expect } from "@playwright/test";

/**
 * Этап 5.8. Обучение при первом запуске: тур по интерфейсу.
 * Контекст теста — без флага onboarded (глобальный storageState отключён).
 */

async function freshPage(browser: import("@playwright/test").Browser) {
  // Пустое storageState перекрывает глобальный флаг onboarded.
  const context = await browser.newContext({
    locale: "ru-RU",
    storageState: { cookies: [], origins: [] },
  });
  const page = await context.newPage();
  await page.goto("/");
  return { context, page };
}

test("первый запуск показывает тур, прохождение ставит флаг", async ({
  browser,
}) => {
  const { context, page } = await freshPage(browser);
  const tour = page.getByRole("dialog", { name: "Обучение" });

  await expect(tour).toBeVisible({ timeout: 15_000 });
  await expect(tour.getByText("Добро пожаловать в Томте")).toBeVisible();

  // Шаг про промпты с прожектором на реальный элемент.
  await tour.getByRole("button", { name: "Далее" }).click();
  await expect(tour.getByText("Промпты")).toBeVisible();

  // Доходим до конца.
  for (let i = 0; i < 6; i++) {
    await tour.getByRole("button", { name: "Далее" }).click();
  }
  await expect(tour.getByRole("heading", { name: "Готово" })).toBeVisible();
  await tour.getByRole("button", { name: "Готово" }).click();
  await expect(tour).toBeHidden();

  // Флаг поставлен: после перезагрузки тура нет.
  await page.reload();
  await page.waitForTimeout(1500);
  await expect(page.getByRole("dialog", { name: "Обучение" })).toBeHidden();
  await context.close();
});

test("тур перезапускается из шпаргалки и пропускается", async ({ browser }) => {
  const { context, page } = await freshPage(browser);
  const tour = page.getByRole("dialog", { name: "Обучение" });

  // Проходим тур (пропуск тоже ставит флаг).
  await expect(tour).toBeVisible({ timeout: 15_000 });
  await tour.getByRole("button", { name: "Пропустить" }).first().click();
  await expect(tour).toBeHidden();

  // Перезапуск из шпаргалки («?»).
  await page.keyboard.press("?");
  const shortcuts = page.getByRole("dialog", { name: "Горячие клавиши" });
  await expect(shortcuts).toBeVisible();
  await shortcuts.getByRole("button", { name: "Показать обучение" }).click();

  await expect(tour).toBeVisible();
  await expect(tour.getByText("Добро пожаловать в Томте")).toBeVisible();
  await context.close();
});
