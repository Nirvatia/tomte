// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from "vitest";
import { get } from "svelte/store";
import { tick } from "svelte";
import { render, screen, fireEvent } from "@testing-library/svelte";
import "@testing-library/jest-dom/vitest";

import ConfirmModal from "../../../src/components/ui/ConfirmModal.svelte";
import { confirmState, requestConfirm, requestAlert } from "../../../src/stores/confirm";

describe("ConfirmModal", () => {
  beforeEach(() => {
    // Полный сброс состояния перед каждым тестом
    confirmState.set({
      open: false,
      message: "",
      title: "",
      confirmText: "",
      cancelText: "",
      danger: false,
      hideCancel: false,
    });
  });

  describe("Видимость модалки", () => {
    it("не рендерит dialog, когда open=false", () => {
      render(ConfirmModal);
      expect(screen.queryByRole("alertdialog")).toBeNull();
    });

    it("рендерит dialog, когда open=true", () => {
      confirmState.set({
        open: true,
        message: "Тест",
        title: "",
        confirmText: "",
        cancelText: "",
        danger: false,
        hideCancel: false,
      });
      render(ConfirmModal);
      expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    });

    it("отображает title и message", () => {
      confirmState.set({
        open: true,
        message: "Вы точно хотите удалить файл?",
        title: "Подтверждение удаления",
        confirmText: "",
        cancelText: "",
        danger: false,
        hideCancel: false,
      });
      render(ConfirmModal);
      expect(screen.getByText("Подтверждение удаления")).toBeInTheDocument();
      expect(
        screen.getByText("Вы точно хотите удалить файл?"),
      ).toBeInTheDocument();
    });

    it("использует title='Подтверждение' по умолчанию, если title пустой", () => {
      confirmState.set({
        open: true,
        message: "Test",
        title: "",
        confirmText: "",
        cancelText: "",
        danger: false,
        hideCancel: false,
      });
      render(ConfirmModal);
      expect(screen.getByText("Подтверждение")).toBeInTheDocument();
    });
  });

  describe("Кнопки действий", () => {
    it("рендерит кнопки с дефолтными текстами", () => {
      confirmState.set({
        open: true,
        message: "Test",
        title: "",
        confirmText: "",
        cancelText: "",
        danger: false,
        hideCancel: false,
      });
      render(ConfirmModal);
      expect(screen.getByText("Подтвердить")).toBeInTheDocument();
      expect(screen.getByText("Отмена")).toBeInTheDocument();
    });

    it("рендерит кнопки с кастомными текстами", () => {
      confirmState.set({
        open: true,
        message: "Test",
        title: "",
        confirmText: "Удалить",
        cancelText: "Оставить",
        danger: false,
        hideCancel: false,
      });
      render(ConfirmModal);
      expect(screen.getByText("Удалить")).toBeInTheDocument();
      expect(screen.getByText("Оставить")).toBeInTheDocument();
    });

    it("скрывает кнопку 'Отмена' при hideCancel=true (режим alert)", () => {
      confirmState.set({
        open: true,
        message: "Информация",
        title: "",
        confirmText: "Понятно",
        cancelText: "",
        danger: false,
        hideCancel: true,
      });
      render(ConfirmModal);
      expect(screen.getByText("Понятно")).toBeInTheDocument();
      expect(screen.queryByText("Отмена")).toBeNull();
    });
  });

  describe("Визуальные варианты (danger)", () => {
    it("применяет красный индикатор при danger=true", () => {
      confirmState.set({
        open: true,
        message: "Опасное действие",
        title: "",
        confirmText: "",
        cancelText: "",
        danger: true,
        hideCancel: false,
      });
      const { container } = render(ConfirmModal);
      // Ищем элемент с классом, содержащим var(--error)
      const dangerElement = container.querySelector(
        '[class*="bg-[var(--error)]"]',
      );
      expect(dangerElement).toBeInTheDocument();
    });

    it("применяет акцентный индикатор при danger=false", () => {
      confirmState.set({
        open: true,
        message: "Обычное действие",
        title: "",
        confirmText: "",
        cancelText: "",
        danger: false,
        hideCancel: false,
      });
      const { container } = render(ConfirmModal);
      const accentElement = container.querySelector(
        '[class*="bg-[var(--accent)]"]',
      );
      expect(accentElement).toBeInTheDocument();
    });
  });

  describe("Закрытие и резолв промисов", () => {
    it("клик по кнопке 'Подтвердить' закрывает модалку и резолвит true", async () => {
      const promise = requestConfirm({
        message: "Тест подтверждения",
        confirmText: "Да",
        cancelText: "Нет",
      });
      render(ConfirmModal);

      await tick();
      const confirmBtn = screen.getByText("Да");
      await fireEvent.click(confirmBtn);
      await tick();

      expect(await promise).toBe(true);
      expect(get(confirmState).open).toBe(false);
    });

    it("клик по кнопке 'Отмена' закрывает модалку и резолвит false", async () => {
      const promise = requestConfirm({
        message: "Тест отмены",
        confirmText: "Да",
        cancelText: "Нет",
      });
      render(ConfirmModal);

      await tick();
      const cancelBtn = screen.getByText("Нет");
      await fireEvent.click(cancelBtn);
      await tick();

      expect(await promise).toBe(false);
      expect(get(confirmState).open).toBe(false);
    });

    it("клик по фону (backdrop) закрывает модалку с false для обычного confirm", async () => {
      const promise = requestConfirm({
        message: "Тест",
        confirmText: "Да",
        cancelText: "Нет",
      });
      const { container } = render(ConfirmModal);

      await tick();
      const backdrop = container.querySelector('[role="alertdialog"]');
      await fireEvent.click(backdrop!);
      await tick();

      expect(await promise).toBe(false);
    });

    it("клик по фону закрывает alert с true (hideCancel=true)", async () => {
      const promise = requestAlert({
        message: "Alert!",
        confirmText: "OK",
      });
      const { container } = render(ConfirmModal);

      await tick();
      const backdrop = container.querySelector('[role="alertdialog"]');
      await fireEvent.click(backdrop!);
      await tick();

      expect(await promise).toBe(true);
    });

    it("нажатие Escape закрывает confirm с false", async () => {
      const promise = requestConfirm({
        message: "Test",
        confirmText: "Да",
        cancelText: "Нет",
      });
      render(ConfirmModal);

      await tick();
      await fireEvent.keyDown(window, { key: "Escape" });
      await tick();

      expect(await promise).toBe(false);
    });

    it("нажатие Escape закрывает alert с true", async () => {
      const promise = requestAlert({
        message: "Alert",
        confirmText: "OK",
      });
      render(ConfirmModal);

      await tick();
      await fireEvent.keyDown(window, { key: "Escape" });
      await tick();

      expect(await promise).toBe(true);
    });
  });
});