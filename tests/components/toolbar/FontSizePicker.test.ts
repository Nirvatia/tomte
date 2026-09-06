// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/svelte";
import "@testing-library/jest-dom/vitest";

import FontSizePicker from "../../../src/components/toolbar/FontSizePicker.svelte";

function makeEditorMock() {
  const run = vi.fn();
  const setFontSize = vi.fn(() => ({ run }));
  const unsetFontSize = vi.fn(() => ({ run }));
  const focus = vi.fn(() => ({ setFontSize, unsetFontSize }));
  const chain = vi.fn(() => ({ focus }));
  const getAttributes = vi.fn(() => ({}));

  return {
    chain,
    focus,
    setFontSize,
    unsetFontSize,
    run,
    getAttributes,
  };
}

describe("FontSizePicker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Рендеринг", () => {
    it("показывает кнопку размера шрифта", () => {
      render(FontSizePicker, {
        props: { editor: null },
      });

      expect(
        screen.getByRole("button", { name: "Размер шрифта" }),
      ).toBeInTheDocument();
    });

    it("не показывает дропдаун по умолчанию", () => {
      render(FontSizePicker, {
        props: { editor: null },
      });

      expect(
        screen.queryByRole("dialog", { name: "Выбор размера шрифта" }),
      ).toBeNull();
    });
  });

  describe("Открытие и закрытие", () => {
    it("открывает дропдаун по клику", async () => {
      render(FontSizePicker, {
        props: { editor: null },
      });

      await fireEvent.click(
        screen.getByRole("button", { name: "Размер шрифта" }),
      );

      expect(
        await screen.findByRole("dialog", {
          name: "Выбор размера шрифта",
        }),
      ).toBeInTheDocument();
    });

    it("показывает список размеров шрифта", async () => {
      render(FontSizePicker, {
        props: { editor: null },
      });

      await fireEvent.click(
        screen.getByRole("button", { name: "Размер шрифта" }),
      );

      expect(await screen.findByText("XS")).toBeInTheDocument();
      expect(screen.getByText("SM")).toBeInTheDocument();
      expect(screen.getByText("MD")).toBeInTheDocument();
      expect(screen.getByText("LG")).toBeInTheDocument();
      expect(screen.getByText("XL")).toBeInTheDocument();
      expect(screen.getByText("2XL")).toBeInTheDocument();
      expect(screen.getByText("3XL")).toBeInTheDocument();
      expect(screen.getByText("4XL")).toBeInTheDocument();
    });

    it("показывает кнопку сброса размера", async () => {
      render(FontSizePicker, {
        props: { editor: null },
      });

      await fireEvent.click(
        screen.getByRole("button", { name: "Размер шрифта" }),
      );

      expect(await screen.findByText("По умолчанию")).toBeInTheDocument();
    });
  });

  describe("Выбор размера", () => {
    it("вызывает setFontSize при выборе размера", async () => {
      const editor = makeEditorMock();

      render(FontSizePicker, {
        props: { editor: editor as any },
      });

      await fireEvent.click(
        screen.getByRole("button", { name: "Размер шрифта" }),
      );

      // Кликаем на кнопку с размером LG (1.125rem)
      const lgButton = await screen.findByText("LG");
      // Кнопка содержит текст "Пример текста", кликаем на родительскую кнопку
      await fireEvent.click(lgButton.closest("button")!);

      expect(editor.setFontSize).toHaveBeenCalledWith("1.125rem");
    });

    it("вызывает unsetFontSize при сбросе", async () => {
      const editor = makeEditorMock();

      render(FontSizePicker, {
        props: { editor: editor as any },
      });

      await fireEvent.click(
        screen.getByRole("button", { name: "Размер шрифта" }),
      );

      const resetButton = await screen.findByText("По умолчанию");
      await fireEvent.click(resetButton.closest("button")!);

      expect(editor.unsetFontSize).toHaveBeenCalled();
    });

    it("закрывает дропдаун после выбора размера", async () => {
      const editor = makeEditorMock();

      render(FontSizePicker, {
        props: { editor: editor as any },
      });

      await fireEvent.click(
        screen.getByRole("button", { name: "Размер шрифта" }),
      );

      const lgButton = await screen.findByText("LG");
      await fireEvent.click(lgButton.closest("button")!);

      await waitFor(() => {
        expect(
          screen.queryByRole("dialog", {
            name: "Выбор размера шрифта",
          }),
        ).toBeNull();
      });
    });
  });

  describe("Без редактора", () => {
    it("не вызывает ошибку при выборе размера без редактора", async () => {
      render(FontSizePicker, {
        props: { editor: null },
      });

      await fireEvent.click(
        screen.getByRole("button", { name: "Размер шрифта" }),
      );

      const lgButton = await screen.findByText("LG");
      // Не должно бросать ошибку
      await fireEvent.click(lgButton.closest("button")!);
    });
  });
});
