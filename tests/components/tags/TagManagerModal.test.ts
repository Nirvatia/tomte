// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/svelte";
import "@testing-library/jest-dom/vitest";
import { get } from "svelte/store";

import TagManagerModal from "../../../src/components/tags/TagManagerModal.svelte";
import { isTagManagerOpen, tagsVersion } from "../../../src/stores";
import { requestConfirm } from "../../../src/stores/confirm";
import {
  addTag,
  loadTags,
  removeTags,
  sortTags,
  toggleFavorite,
  updateTag,
} from "../../../src/utils/tags";
import type { Tag } from "../../../src/types";

vi.mock("../../../src/stores/confirm", () => ({
  requestConfirm: vi.fn(),
  requestAlert: vi.fn(),
}));

vi.mock("../../../src/utils", () => ({
  pluralize: vi.fn((n: number, one: string, few: string, many: string) => one),
}));

vi.mock("../../../src/utils/tags", () => ({
  loadTags: vi.fn(),
  addTag: vi.fn(),
  updateTag: vi.fn(),
  removeTags: vi.fn(),
  sortTags: vi.fn((tags: Tag[]) => tags),
  toggleFavorite: vi.fn(),
}));

function makeTag(overrides: Partial<Tag> = {}): Tag {
  return {
    id: overrides.id ?? `tag-${Math.random().toString(36).slice(2)}`,
    name: overrides.name ?? "Test Tag",
    value: overrides.value ?? "Test value",
    favorite: overrides.favorite ?? false,
    createdAt: overrides.createdAt ?? new Date().toISOString(),
  };
}

function makeEditorMock() {
  const run = vi.fn();
  const insertContent = vi.fn(() => ({ run }));
  const focus = vi.fn(() => ({ insertContent }));
  const chain = vi.fn(() => ({ focus }));
  const getText = vi.fn(() => "");

  return { chain, focus, insertContent, run, getText };
}

describe("TagManagerModal", () => {
  beforeEach(() => {
    isTagManagerOpen.set(false);
    tagsVersion.set(0);

    vi.clearAllMocks();

    vi.mocked(loadTags).mockReturnValue([]);
    vi.mocked(sortTags).mockImplementation((tags: Tag[]) => tags);
    vi.mocked(requestConfirm).mockResolvedValue(false);
  });

  describe("Видимость", () => {
    it("не рендерится, когда isTagManagerOpen=false", () => {
      render(TagManagerModal);

      expect(
        screen.queryByRole("button", { name: "Закрыть менеджер тегов" }),
      ).toBeNull();
    });
    it("рендерится, когда isTagManagerOpen=true", async () => {
      isTagManagerOpen.set(true);
      render(TagManagerModal);

      // Заголовок уникален — в отличие от кнопки закрытия,
      // у которой дублируется aria-label с фоном.
      expect(await screen.findByText("Менеджер тегов")).toBeInTheDocument();
    });
  });

  describe("Список тегов", () => {
    it("показывает количество тегов", async () => {
      const tags = [makeTag({ name: "Tag A" }), makeTag({ name: "Tag B" })];
      vi.mocked(loadTags).mockReturnValue(tags);

      isTagManagerOpen.set(true);
      render(TagManagerModal);

      await screen.findByText("Tag A");

      expect(screen.getByText("Всего:")).toBeInTheDocument();
      expect(screen.getByText("2")).toBeInTheDocument();
    });

    it("показывает пустое состояние, когда тегов нет", async () => {
      vi.mocked(loadTags).mockReturnValue([]);

      isTagManagerOpen.set(true);
      render(TagManagerModal);

      expect(await screen.findByText("Нет тегов")).toBeInTheDocument();
      expect(
        await screen.findByText(
          "Создайте первый тег, чтобы быстро вставлять инструкции в промпт",
        ),
      ).toBeInTheDocument();
    });

    it("рендерит список тегов", async () => {
      const tags = [
        makeTag({ id: "1", name: "Alpha", value: "Alpha value" }),
        makeTag({ id: "2", name: "Beta", value: "Beta value" }),
      ];
      vi.mocked(loadTags).mockReturnValue(tags);

      isTagManagerOpen.set(true);
      render(TagManagerModal);

      await screen.findByText("Alpha");
      await screen.findByText("Beta");
    });

    it("показывает имя и значение тега", async () => {
      const tag = makeTag({ name: "My Tag", value: "My instruction text" });
      vi.mocked(loadTags).mockReturnValue([tag]);

      isTagManagerOpen.set(true);
      render(TagManagerModal);

      await screen.findByText("My Tag");
      expect(
        await screen.findByText("My instruction text"),
      ).toBeInTheDocument();
    });
  });

  describe("Поиск", () => {
    it("фильтрует теги по имени", async () => {
      const tags = [
        makeTag({ id: "1", name: "Alpha" }),
        makeTag({ id: "2", name: "Beta" }),
      ];
      vi.mocked(loadTags).mockReturnValue(tags);

      isTagManagerOpen.set(true);
      render(TagManagerModal);

      await screen.findByText("Alpha");

      const searchInput = screen.getByLabelText("Поиск тегов");
      await fireEvent.input(searchInput, { target: { value: "alph" } });

      expect(await screen.findByText("Alpha")).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.queryByText("Beta")).toBeNull();
      });
    });

    it("показывает 'Ничего не найдено' при пустом результате поиска", async () => {
      const tags = [makeTag({ name: "Alpha" })];
      vi.mocked(loadTags).mockReturnValue(tags);

      isTagManagerOpen.set(true);
      render(TagManagerModal);

      await screen.findByText("Alpha");

      const searchInput = screen.getByLabelText("Поиск тегов");
      await fireEvent.input(searchInput, { target: { value: "zzz" } });

      expect(await screen.findByText("Ничего не найдено")).toBeInTheDocument();
    });
  });

  describe("Фильтр по избранным", () => {
    it("показывает только избранные теги при активном фильтре", async () => {
      const tags = [
        makeTag({ id: "1", name: "Fav Tag", favorite: true }),
        makeTag({ id: "2", name: "Regular Tag", favorite: false }),
      ];
      vi.mocked(loadTags).mockReturnValue(tags);

      isTagManagerOpen.set(true);
      render(TagManagerModal);

      await screen.findByText("Fav Tag");
      await screen.findByText("Regular Tag");

      const favFilterButton = screen.getByText("Избранные");
      await fireEvent.click(favFilterButton);

      expect(await screen.findByText("Fav Tag")).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.queryByText("Regular Tag")).toBeNull();
      });
    });

    it("показывает количество избранных", async () => {
      const tags = [
        makeTag({ id: "1", name: "Fav 1", favorite: true }),
        makeTag({ id: "2", name: "Fav 2", favorite: true }),
        makeTag({ id: "3", name: "Not Fav", favorite: false }),
      ];
      vi.mocked(loadTags).mockReturnValue(tags);

      isTagManagerOpen.set(true);
      render(TagManagerModal);

      await screen.findByText("Fav 1");

      expect(await screen.findByText("★ 2 избранных")).toBeInTheDocument();
    });
  });

  describe("Выбор тегов", () => {
    it("выбирает и снимает выбор с тега", async () => {
      const tag = makeTag({ id: "1", name: "Select Tag" });
      vi.mocked(loadTags).mockReturnValue([tag]);

      isTagManagerOpen.set(true);
      render(TagManagerModal);

      await screen.findByText("Select Tag");

      const checkboxes = screen.getAllByRole("checkbox", { name: "Выделить" });
      await fireEvent.click(checkboxes[0]);

      expect(
        screen.getByRole("button", { name: /Удалить \(1\)/ }),
      ).toBeInTheDocument();

      const selectedCheckboxes = screen.getAllByRole("checkbox", {
        name: "Снять выделение",
      });
      await fireEvent.click(selectedCheckboxes[1]);

      await waitFor(() => {
        expect(
          screen.queryByRole("button", { name: /Удалить \(1\)/ }),
        ).toBeNull();
      });
    });

    it("кнопка 'Выбрать все' выбирает все теги", async () => {
      const tags = [
        makeTag({ id: "1", name: "Tag 1" }),
        makeTag({ id: "2", name: "Tag 2" }),
      ];
      vi.mocked(loadTags).mockReturnValue(tags);

      isTagManagerOpen.set(true);
      render(TagManagerModal);

      await screen.findByText("Tag 1");

      const selectAllButton = screen.getByRole("button", {
        name: "Выбрать все",
      });
      await fireEvent.click(selectAllButton);

      expect(
        screen.getByRole("button", { name: /Удалить \(2\)/ }),
      ).toBeInTheDocument();
    });
  });

  describe("Удаление тегов", () => {
    it("удаляет выбранные теги после подтверждения", async () => {
      vi.mocked(requestConfirm).mockResolvedValue(true);

      const tags = [
        makeTag({ id: "1", name: "Delete Me" }),
        makeTag({ id: "2", name: "Keep Me" }),
      ];
      vi.mocked(loadTags).mockReturnValue(tags);

      isTagManagerOpen.set(true);
      render(TagManagerModal);

      await screen.findByText("Delete Me");

      // Выбираем первый тег
      const checkboxes = screen.getAllByRole("checkbox", { name: "Выделить" });
      await fireEvent.click(checkboxes[0]);

      // Нажимаем удалить выбранные
      const deleteButton = screen.getByRole("button", {
        name: /Удалить \(1\)/,
      });
      await fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(requestConfirm).toHaveBeenCalledWith(
          expect.objectContaining({
            title: "Удалить теги?",
            danger: true,
          }),
        );
      });

      await waitFor(() => {
        expect(removeTags).toHaveBeenCalled();
      });
    });

    it("не удаляет теги, если подтверждение отменено", async () => {
      vi.mocked(requestConfirm).mockResolvedValue(false);

      const tags = [makeTag({ id: "1", name: "Delete Me" })];
      vi.mocked(loadTags).mockReturnValue(tags);

      isTagManagerOpen.set(true);
      render(TagManagerModal);

      await screen.findByText("Delete Me");

      const checkboxes = screen.getAllByRole("checkbox", { name: "Выделить" });
      await fireEvent.click(checkboxes[0]);

      const deleteButton = screen.getByRole("button", {
        name: /Удалить \(1\)/,
      });
      await fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(requestConfirm).toHaveBeenCalled();
      });

      expect(removeTags).not.toHaveBeenCalled();
    });

    it("удаляет один тег по кнопке удаления", async () => {
      vi.mocked(requestConfirm).mockResolvedValue(true);

      const tag = makeTag({ id: "single", name: "Single Tag" });
      vi.mocked(loadTags).mockReturnValue([tag]);

      isTagManagerOpen.set(true);
      render(TagManagerModal);

      await screen.findByText("Single Tag");

      const deleteButton = screen.getByRole("button", {
        name: "Удалить тег Single Tag",
      });
      await fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(requestConfirm).toHaveBeenCalledWith(
          expect.objectContaining({
            title: "Удалить тег?",
            danger: true,
          }),
        );
      });

      await waitFor(() => {
        expect(removeTags).toHaveBeenCalledWith(new Set(["single"]));
      });
    });
  });

  describe("Избранное", () => {
    it("переключает избранное по клику на звезду", async () => {
      const tag = makeTag({ id: "fav-1", name: "Fav Tag", favorite: false });
      vi.mocked(loadTags).mockReturnValue([tag]);

      isTagManagerOpen.set(true);
      render(TagManagerModal);

      await screen.findByText("Fav Tag");

      const favButton = screen.getByRole("button", {
        name: "Добавить в избранные",
      });
      await fireEvent.click(favButton);

      expect(toggleFavorite).toHaveBeenCalledWith("fav-1");
    });
  });

  describe("Применение тега к редактору", () => {
    it("вставляет текст тега в редактор", async () => {
      const editor = makeEditorMock();
      const tag = makeTag({
        id: "apply-1",
        name: "Apply Tag",
        value: "Apply this instruction",
      });
      vi.mocked(loadTags).mockReturnValue([tag]);

      isTagManagerOpen.set(true);
      render(TagManagerModal, {
        props: { editor: editor as any },
      });

      await screen.findByText("Apply Tag");

      const applyButton = screen.getByRole("button", {
        name: "Применить тег Apply Tag",
      });
      await fireEvent.click(applyButton);

      expect(editor.chain).toHaveBeenCalled();
      expect(editor.focus).toHaveBeenCalled();
      expect(editor.insertContent).toHaveBeenCalledWith(
        "Apply this instruction\n",
      );
      expect(editor.run).toHaveBeenCalled();
    });

    it("добавляет перенос строки перед текстом, если редактор не пустой", async () => {
      const editor = makeEditorMock();
      editor.getText.mockReturnValue("Existing content");

      const tag = makeTag({
        id: "apply-2",
        name: "Apply Tag",
        value: "New instruction",
      });
      vi.mocked(loadTags).mockReturnValue([tag]);

      isTagManagerOpen.set(true);
      render(TagManagerModal, {
        props: { editor: editor as any },
      });

      await screen.findByText("Apply Tag");

      const applyButton = screen.getByRole("button", {
        name: "Применить тег Apply Tag",
      });
      await fireEvent.click(applyButton);

      expect(editor.insertContent).toHaveBeenCalledWith("\nNew instruction\n");
    });

    it("не добавляет перенос, если текст уже заканчивается переносом", async () => {
      const editor = makeEditorMock();
      editor.getText.mockReturnValue("Existing content\n");

      const tag = makeTag({
        id: "apply-3",
        name: "Apply Tag",
        value: "New instruction",
      });
      vi.mocked(loadTags).mockReturnValue([tag]);

      isTagManagerOpen.set(true);
      render(TagManagerModal, {
        props: { editor: editor as any },
      });

      await screen.findByText("Apply Tag");

      const applyButton = screen.getByRole("button", {
        name: "Применить тег Apply Tag",
      });
      await fireEvent.click(applyButton);

      expect(editor.insertContent).toHaveBeenCalledWith("New instruction\n");
    });

    it("закрывает модалку после применения тега", async () => {
      const editor = makeEditorMock();
      const tag = makeTag({ id: "apply-4", name: "Apply Tag", value: "Text" });
      vi.mocked(loadTags).mockReturnValue([tag]);

      isTagManagerOpen.set(true);
      render(TagManagerModal, {
        props: { editor: editor as any },
      });

      await screen.findByText("Apply Tag");

      const applyButton = screen.getByRole("button", {
        name: "Применить тег Apply Tag",
      });
      await fireEvent.click(applyButton);

      await waitFor(() => {
        expect(get(isTagManagerOpen)).toBe(false);
      });
    });
  });

  describe("Форма создания/редактирования", () => {
    it("открывает форму создания по кнопке 'Новый тег'", async () => {
      isTagManagerOpen.set(true);
      render(TagManagerModal);

      await screen.findByText("Нет тегов");

      const newTagButton = screen.getByRole("button", {
        name: /Новый тег/,
      });
      await fireEvent.click(newTagButton);

      expect(await screen.findByLabelText("Название")).toBeInTheDocument();
      expect(
        await screen.findByLabelText("Текст инструкции"),
      ).toBeInTheDocument();
    });

    it("создаёт новый тег через форму", async () => {
      isTagManagerOpen.set(true);
      render(TagManagerModal);

      await screen.findByText("Нет тегов");

      await fireEvent.click(screen.getByRole("button", { name: /Новый тег/ }));

      await fireEvent.input(screen.getByLabelText("Название"), {
        target: { value: "Form Tag" },
      });
      await fireEvent.input(screen.getByLabelText("Текст инструкции"), {
        target: { value: "Form value" },
      });

      await fireEvent.click(screen.getByText("Создать"));

      expect(addTag).toHaveBeenCalledWith("Form Tag", "Form value");
    });

    it("открывает форму редактирования по кнопке карандаша", async () => {
      const tag = makeTag({
        id: "edit-1",
        name: "Edit Me",
        value: "Edit value",
      });
      vi.mocked(loadTags).mockReturnValue([tag]);

      isTagManagerOpen.set(true);
      render(TagManagerModal);

      await screen.findByText("Edit Me");

      const editButton = screen.getByRole("button", {
        name: "Редактировать тег Edit Me",
      });
      await fireEvent.click(editButton);

      expect(await screen.findByLabelText("Название")).toHaveValue("Edit Me");
      expect(await screen.findByLabelText("Текст инструкции")).toHaveValue(
        "Edit value",
      );
    });

    it("обновляет тег через форму редактирования", async () => {
      const tag = makeTag({
        id: "edit-2",
        name: "Old Name",
        value: "Old value",
      });
      vi.mocked(loadTags).mockReturnValue([tag]);

      isTagManagerOpen.set(true);
      render(TagManagerModal);

      await screen.findByText("Old Name");

      const editButton = screen.getByRole("button", {
        name: "Редактировать тег Old Name",
      });
      await fireEvent.click(editButton);

      await fireEvent.input(screen.getByLabelText("Название"), {
        target: { value: "New Name" },
      });
      await fireEvent.input(screen.getByLabelText("Текст инструкции"), {
        target: { value: "New value" },
      });

      await fireEvent.click(screen.getByText("Сохранить"));

      expect(updateTag).toHaveBeenCalledWith("edit-2", "New Name", "New value");
    });

    it("закрывает форму по кнопке Отмена", async () => {
      isTagManagerOpen.set(true);
      render(TagManagerModal);

      await screen.findByText("Нет тегов");

      await fireEvent.click(screen.getByRole("button", { name: /Новый тег/ }));

      await screen.findByLabelText("Название");

      await fireEvent.click(screen.getByText("Отмена"));

      await waitFor(() => {
        expect(screen.queryByLabelText("Название")).toBeNull();
      });
    });
  });

  describe("Закрытие модалки", () => {
it("закрывается кнопкой крестика", async () => {
  isTagManagerOpen.set(true);
  render(TagManagerModal);

  await screen.findByText("Нет тегов");

  // Находим все элементы с ролью "кнопка" и именем "Закрыть менеджер тегов".
  // Сюда попадают и фон (div с role="button"), и сам крестик (<button>).
  const closeElements = screen.getAllByRole("button", {
    name: "Закрыть менеджер тегов",
  });

  // Нам нужен именно настоящий <button>, а не фон-обертка.
  const closeButton = closeElements.find((el) => el.tagName === "BUTTON");

  await fireEvent.click(closeButton!);

  await waitFor(() => {
    expect(get(isTagManagerOpen)).toBe(false);
  });
});

    it("закрывается по клику на фон", async () => {
      isTagManagerOpen.set(true);
      render(TagManagerModal);

      await screen.findByText("Нет тегов");

      const backdrop = screen.getAllByLabelText("Закрыть менеджер тегов")[0];

      await fireEvent.click(backdrop);

      await waitFor(() => {
        expect(get(isTagManagerOpen)).toBe(false);
      });
    });

    it("закрывается по Escape", async () => {
      isTagManagerOpen.set(true);
      render(TagManagerModal);

      await screen.findByText("Нет тегов");

      await fireEvent.keyDown(window, { key: "Escape" });

      await waitFor(() => {
        expect(get(isTagManagerOpen)).toBe(false);
      });
    });

    it("Escape закрывает форму, но не модалку, если форма открыта", async () => {
      isTagManagerOpen.set(true);
      render(TagManagerModal);

      await screen.findByText("Нет тегов");

      await fireEvent.click(screen.getByRole("button", { name: /Новый тег/ }));

      await screen.findByLabelText("Название");

      await fireEvent.keyDown(window, { key: "Escape" });

      // Форма должна закрыться
      await waitFor(() => {
        expect(screen.queryByLabelText("Название")).toBeNull();
      });

      // Но модалка остаётся открытой
      expect(get(isTagManagerOpen)).toBe(true);
    });
  });

  describe("Сброс состояния при открытии", () => {
    it("сбрасывает поиск при повторном открытии", async () => {
      const tags = [makeTag({ name: "Visible Tag" })];
      vi.mocked(loadTags).mockReturnValue(tags);

      isTagManagerOpen.set(true);
      render(TagManagerModal);

      await screen.findByText("Visible Tag");

      const searchInput = screen.getByLabelText("Поиск тегов");
      await fireEvent.input(searchInput, { target: { value: "zzz" } });

      await screen.findByText("Ничего не найдено");

      // Закрываем и открываем снова
      isTagManagerOpen.set(false);
      isTagManagerOpen.set(true);

      await waitFor(() => {
        expect(screen.getByLabelText("Поиск тегов")).toHaveValue("");
      });
    });
  });
});
