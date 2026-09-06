// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/svelte";
import "@testing-library/jest-dom/vitest";

import TablePicker from "../../../src/components/toolbar/TablePicker.svelte";

function makeEditorMock() {
  const run = vi.fn();
  const insertTable = vi.fn(() => ({ run }));
  const focus = vi.fn(() => ({ insertTable }));
  const chain = vi.fn(() => ({ focus }));
  const isActive = vi.fn(() => false);

  return {
    chain,
    focus,
    insertTable,
    run,
    isActive,
  };
}

describe("TablePicker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Рендеринг", () => {
    it("показывает кнопку вставки таблицы", () => {
      render(TablePicker, {
        props: { editor: null },
      });

      expect(
        screen.getByRole("button", { name: "Вставить таблицу" }),
      ).toBeInTheDocument();
    });

    it("не показывает сетку по умолчанию", () => {
      render(TablePicker, {
        props: { editor: null },
      });

      expect(
        screen.queryByRole("dialog", { name: "Выбор размера таблицы" }),
      ).toBeNull();
    });
  });

  describe("Открытие и закрытие", () => {
    it("открывает сетку по клику", async () => {
      render(TablePicker, {
        props: { editor: null },
      });

      await fireEvent.click(
        screen.getByRole("button", { name: "Вставить таблицу" }),
      );

      expect(
        await screen.findByRole("dialog", {
          name: "Выбор размера таблицы",
        }),
      ).toBeInTheDocument();
    });

    it("показывает сетку 8x8", async () => {
      render(TablePicker, {
        props: { editor: null },
      });

      await fireEvent.click(
        screen.getByRole("button", { name: "Вставить таблицу" }),
      );

      await screen.findByRole("dialog", { name: "Выбор размера таблицы" });

      // 8x8 = 64 ячейки
      const cells = screen.getAllByRole("button", { name: /Таблица \d+×\d+/ });
      expect(cells).toHaveLength(64);
    });

    it("показывает начальный размер 1×1", async () => {
      render(TablePicker, {
        props: { editor: null },
      });

      await fireEvent.click(
        screen.getByRole("button", { name: "Вставить таблицу" }),
      );

      await screen.findByRole("dialog", { name: "Выбор размера таблицы" });

      expect(screen.getByText("1 × 1")).toBeInTheDocument();
    });
  });

  describe("Выбор размера таблицы", () => {
    it("вставляет таблицу при клике на ячейку", async () => {
      const editor = makeEditorMock();

      render(TablePicker, {
        props: { editor: editor as any },
      });

      await fireEvent.click(
        screen.getByRole("button", { name: "Вставить таблицу" }),
      );

      await screen.findByRole("dialog", { name: "Выбор размера таблицы" });

      // Кликаем на ячейку 3×2 (строка 2, столбец 1 — индексы с 0)
      const cell = screen.getByRole("button", { name: "Таблица 3×2" });
      await fireEvent.click(cell);

      expect(editor.insertTable).toHaveBeenCalledWith({
        rows: 3,
        cols: 2,
        withHeaderRow: true,
      });
    });

    it("закрывает сетку после вставки таблицы", async () => {
      const editor = makeEditorMock();

      render(TablePicker, {
        props: { editor: editor as any },
      });

      await fireEvent.click(
        screen.getByRole("button", { name: "Вставить таблицу" }),
      );

      await screen.findByRole("dialog", { name: "Выбор размера таблицы" });

      const cell = screen.getByRole("button", { name: "Таблица 2×2" });
      await fireEvent.click(cell);

      await waitFor(() => {
        expect(
          screen.queryByRole("dialog", {
            name: "Выбор размера таблицы",
          }),
        ).toBeNull();
      });
    });
  });

  describe("Навигация с клавиатуры", () => {
    it("перемещает выделение стрелками", async () => {
      render(TablePicker, {
        props: { editor: null },
      });

      await fireEvent.click(
        screen.getByRole("button", { name: "Вставить таблицу" }),
      );

      await screen.findByRole("dialog", { name: "Выбор размера таблицы" });

      // Изначальный размер 1×1
      expect(screen.getByText("1 × 1")).toBeInTheDocument();

      // Нажимаем стрелку вниз — должно стать 2×1
      await fireEvent.keyDown(window, { key: "ArrowDown" });
      expect(await screen.findByText("2 × 1")).toBeInTheDocument();

      // Нажимаем стрелку вправо — должно стать 2×2
      await fireEvent.keyDown(window, { key: "ArrowRight" });
      expect(await screen.findByText("2 × 2")).toBeInTheDocument();
    });

    it("закрывает сетку по Escape", async () => {
      render(TablePicker, {
        props: { editor: null },
      });

      await fireEvent.click(
        screen.getByRole("button", { name: "Вставить таблицу" }),
      );

      await screen.findByRole("dialog", { name: "Выбор размера таблицы" });

      await fireEvent.keyDown(window, { key: "Escape" });

      await waitFor(() => {
        expect(
          screen.queryByRole("dialog", {
            name: "Выбор размера таблицы",
          }),
        ).toBeNull();
      });
    });
  });

  describe("Без редактора", () => {
    it("не вызывает ошибку при клике на ячейку без редактора", async () => {
      render(TablePicker, {
        props: { editor: null },
      });

      await fireEvent.click(
        screen.getByRole("button", { name: "Вставить таблицу" }),
      );

      await screen.findByRole("dialog", { name: "Выбор размера таблицы" });

      const cell = screen.getByRole("button", { name: "Таблица 2×2" });
      // Не должно бросать ошибку
      await fireEvent.click(cell);
    });
  });
});
