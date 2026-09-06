// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/svelte";
import "@testing-library/jest-dom/vitest";

import TagCreateModal from "../../../src/components/tags/TagCreateModal.svelte";
import type { Tag } from "../../../src/types";

const baseProps = {
  isOpen: true,
  onClose: vi.fn(),
  onCreate: vi.fn(),
  onUpdate: vi.fn(),
  editingTag: null as Tag | null,
};

function makeTag(overrides: Partial<Tag> = {}): Tag {
  return {
    id: "tag-1",
    name: "Test Tag",
    value: "Test value content",
    favorite: false,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("TagCreateModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Видимость", () => {
    it("не рендерится, когда isOpen=false", () => {
      render(TagCreateModal, {
        props: { ...baseProps, isOpen: false },
      });

      expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("рендерится, когда isOpen=true", async () => {
      render(TagCreateModal, {
        props: { ...baseProps, isOpen: true },
      });

      expect(await screen.findByRole("dialog")).toBeInTheDocument();
    });
  });

  describe("Заголовок", () => {
    it("показывает 'Новый тег' в режиме создания", () => {
      render(TagCreateModal, {
        props: { ...baseProps, editingTag: null },
      });

      expect(screen.getByText("Новый тег")).toBeInTheDocument();
    });

    it("показывает 'Редактировать тег' в режиме редактирования", () => {
      render(TagCreateModal, {
        props: { ...baseProps, editingTag: makeTag() },
      });

      expect(screen.getByText("Редактировать тег")).toBeInTheDocument();
    });
  });

  describe("Префилл полей", () => {
    it("заполняет поля при редактировании тега", () => {
      const tag = makeTag({ name: "My Tag", value: "My instruction" });

      render(TagCreateModal, {
        props: { ...baseProps, editingTag: tag },
      });

      expect(screen.getByLabelText("Название")).toHaveValue("My Tag");
      expect(screen.getByLabelText("Текст инструкции")).toHaveValue(
        "My instruction",
      );
    });

    it("поля пустые в режиме создания", () => {
      render(TagCreateModal, {
        props: { ...baseProps, editingTag: null },
      });

      expect(screen.getByLabelText("Название")).toHaveValue("");
      expect(screen.getByLabelText("Текст инструкции")).toHaveValue("");
    });
  });

  describe("Кнопка отправки", () => {
    it("заблокирована, когда оба поля пустые", () => {
      render(TagCreateModal, { props: baseProps });

      expect(screen.getByText("Создать")).toBeDisabled();
    });

    it("заблокирована, когда только название заполнено", async () => {
      render(TagCreateModal, { props: baseProps });

      const nameInput = screen.getByLabelText("Название");
      await fireEvent.input(nameInput, { target: { value: "Name" } });

      expect(screen.getByText("Создать")).toBeDisabled();
    });

    it("заблокирована, когда только текст заполнен", async () => {
      render(TagCreateModal, { props: baseProps });

      const valueInput = screen.getByLabelText("Текст инструкции");
      await fireEvent.input(valueInput, { target: { value: "Value" } });

      expect(screen.getByText("Создать")).toBeDisabled();
    });

    it("активна, когда оба поля заполнены", async () => {
      render(TagCreateModal, { props: baseProps });

      await fireEvent.input(screen.getByLabelText("Название"), {
        target: { value: "Name" },
      });
      await fireEvent.input(screen.getByLabelText("Текст инструкции"), {
        target: { value: "Value" },
      });

      expect(screen.getByText("Создать")).toBeEnabled();
    });

    it("показывает 'Сохранить' в режиме редактирования", () => {
      render(TagCreateModal, {
        props: { ...baseProps, editingTag: makeTag() },
      });

      expect(screen.getByText("Сохранить")).toBeInTheDocument();
    });
  });

  describe("Создание тега", () => {
    it("вызывает onCreate с именем и значением", async () => {
      const onCreate = vi.fn();

      render(TagCreateModal, {
        props: { ...baseProps, onCreate },
      });

      await fireEvent.input(screen.getByLabelText("Название"), {
        target: { value: "New Tag" },
      });
      await fireEvent.input(screen.getByLabelText("Текст инструкции"), {
        target: { value: "New instruction" },
      });

      await fireEvent.click(screen.getByText("Создать"));

      expect(onCreate).toHaveBeenCalledWith("New Tag", "New instruction");
    });

    it("вызывает onClose после создания", async () => {
      const onClose = vi.fn();

      render(TagCreateModal, {
        props: { ...baseProps, onClose },
      });

      await fireEvent.input(screen.getByLabelText("Название"), {
        target: { value: "Tag" },
      });
      await fireEvent.input(screen.getByLabelText("Текст инструкции"), {
        target: { value: "Value" },
      });

      await fireEvent.click(screen.getByText("Создать"));

      expect(onClose).toHaveBeenCalled();
    });

    it("не вызывает onCreate при пустых полях", async () => {
      const onCreate = vi.fn();

      render(TagCreateModal, {
        props: { ...baseProps, onCreate },
      });

      const submitButton = screen.getByText("Создать");

      // Кнопка заблокирована, но проверим через Enter в поле имени
      await fireEvent.input(screen.getByLabelText("Название"), {
        target: { value: "" },
      });
      await fireEvent.keyDown(screen.getByLabelText("Название"), {
        key: "Enter",
      });

      expect(onCreate).not.toHaveBeenCalled();
    });
  });

  describe("Редактирование тега", () => {
    it("вызывает onUpdate с id, именем и значением", async () => {
      const onUpdate = vi.fn();
      const tag = makeTag({ id: "edit-id" });

      render(TagCreateModal, {
        props: { ...baseProps, editingTag: tag, onUpdate },
      });

      await fireEvent.input(screen.getByLabelText("Название"), {
        target: { value: "Updated Name" },
      });
      await fireEvent.input(screen.getByLabelText("Текст инструкции"), {
        target: { value: "Updated Value" },
      });

      await fireEvent.click(screen.getByText("Сохранить"));

      expect(onUpdate).toHaveBeenCalledWith(
        "edit-id",
        "Updated Name",
        "Updated Value",
      );
    });

    it("не вызывает onCreate в режиме редактирования", async () => {
      const onCreate = vi.fn();
      const tag = makeTag();

      render(TagCreateModal, {
        props: { ...baseProps, editingTag: tag, onCreate },
      });

      await fireEvent.input(screen.getByLabelText("Название"), {
        target: { value: "Name" },
      });
      await fireEvent.input(screen.getByLabelText("Текст инструкции"), {
        target: { value: "Value" },
      });

      await fireEvent.click(screen.getByText("Сохранить"));

      expect(onCreate).not.toHaveBeenCalled();
    });
  });

  describe("Закрытие модалки", () => {
    it("закрывается по кнопке крестика", async () => {
      const onClose = vi.fn();

      render(TagCreateModal, {
        props: { ...baseProps, onClose },
      });

      await fireEvent.click(screen.getByLabelText("Закрыть"));

      expect(onClose).toHaveBeenCalled();
    });

    it("закрывается по кнопке Отмена", async () => {
      const onClose = vi.fn();

      render(TagCreateModal, {
        props: { ...baseProps, onClose },
      });

      await fireEvent.click(screen.getByText("Отмена"));

      expect(onClose).toHaveBeenCalled();
    });

    it("закрывается по клику на фон", async () => {
      const onClose = vi.fn();

      render(TagCreateModal, {
        props: { ...baseProps, onClose },
      });

      const dialog = screen.getByRole("dialog");
      const backdrop = dialog.parentElement!;

      await fireEvent.click(backdrop);

      expect(onClose).toHaveBeenCalled();
    });

    it("закрывается по Escape", async () => {
      const onClose = vi.fn();

      render(TagCreateModal, {
        props: { ...baseProps, onClose },
      });

      await fireEvent.keyDown(window, { key: "Escape" });

      expect(onClose).toHaveBeenCalled();
    });

    it("не вызывает onClose, если isOpen=false и нажат Escape", () => {
      const onClose = vi.fn();

      render(TagCreateModal, {
        props: { ...baseProps, isOpen: false, onClose },
      });

      fireEvent.keyDown(window, { key: "Escape" });

      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe("Отправка по Enter", () => {
    it("отправляет форму по Enter в поле названия", async () => {
      const onCreate = vi.fn();

      render(TagCreateModal, {
        props: { ...baseProps, onCreate },
      });

      await fireEvent.input(screen.getByLabelText("Название"), {
        target: { value: "Enter Tag" },
      });
      await fireEvent.input(screen.getByLabelText("Текст инструкции"), {
        target: { value: "Enter Value" },
      });

      await fireEvent.keyDown(screen.getByLabelText("Название"), {
        key: "Enter",
      });

      expect(onCreate).toHaveBeenCalledWith("Enter Tag", "Enter Value");
    });
  });
});
