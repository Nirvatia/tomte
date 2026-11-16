import { test, expect, type Page } from "@playwright/test";

/**
 * Этап 15.2. Поведение, которое изменилось при разбиении компонентов:
 * кнопки форматирования сообщают состояние, меню «Инструменты» работает
 * с клавиатуры, кнопки строки проекта нажимаются с клавиатуры.
 */

async function openApp(page: Page) {
  await page.goto("/");
  await expect(page.locator(".tiptap-prose")).toBeEditable({
    timeout: 15_000,
  });
}

test("кнопка «Жирный» сообщает, включена ли она", async ({ page }) => {
  await openApp(page);
  const bold = page.getByRole("button", { name: "Жирный", exact: true });
  await expect(bold).toHaveAttribute("aria-pressed", "false");

  await page.locator(".tiptap-prose").click();
  await bold.click();
  await page.keyboard.type("текст");
  await expect(bold).toHaveAttribute("aria-pressed", "true");
});

test("меню «Инструменты»: стрелки и Escape", async ({ page }) => {
  await openApp(page);
  const trigger = page.getByRole("button", {
    name: "Открыть меню инструментов",
  });
  await trigger.click();
  const menu = page.getByRole("menu", { name: "Меню инструментов" });
  await expect(menu).toBeVisible();

  // Фокус на первом пункте; стрелки ходят по видимым пунктам
  // (часть пунктов прячется по ширине тулбара).
  const first = menu.getByRole("menuitem", { name: "Предпросмотр" });
  await expect(first).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(first).not.toBeFocused();
  const focusedIsVisibleItem = await menu.evaluate((el) => {
    const active = document.activeElement as HTMLElement | null;
    return (
      !!active &&
      el.contains(active) &&
      active.getAttribute("role") === "menuitem" &&
      active.getClientRects().length > 0
    );
  });
  expect(focusedIsVisibleItem).toBe(true);
  await page.keyboard.press("ArrowUp");
  await expect(first).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("кнопки строки проекта нажимаются с клавиатуры", async ({ page }) => {
  // Раньше Enter на кнопке строки гасился и переключал проект.
  await openApp(page);
  await page
    .getByRole("button", { name: "Открыть менеджер проектов" })
    .first()
    .click();
  const manager = page.getByRole("dialog", { name: "Менеджер проектов" });
  const rename = manager.getByRole("button", {
    name: /^Переименовать проект/,
  });
  await rename.focus();
  await page.keyboard.press("Enter");

  const input = manager.locator("input:visible").last();
  await expect(input).toBeFocused();
  await input.fill("Переименован с клавиатуры");
  await input.press("Enter");
  await expect(manager.getByText("Переименован с клавиатуры")).toBeVisible();
  await expect(manager).toBeVisible();
});
