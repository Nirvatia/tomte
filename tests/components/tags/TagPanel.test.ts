// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
} from "@testing-library/svelte";
import "@testing-library/jest-dom/vitest";
import { get } from "svelte/store";

import TagPanel from "../../../src/components/tags/TagPanel.svelte";
import { tagsVersion } from "../../../src/stores";
import { requestConfirm } from "../../../src/stores/confirm";
import {
  addTag,
  loadTags,
  removeTag,
  sortTags,
  updateTag,
} from "../../../src/utils/tags";
import type { Tag } from "../../../src/types";

vi.mock("../../../src/stores/confirm", () => ({
  requestConfirm: vi.fn(),
  requestAlert: vi.fn(),
}));

vi.mock("../../../src/utils/tags", () => ({
  loadTags: vi.fn(),
  addTag: vi.fn(),
  updateTag: vi.fn(),
  removeTag: vi.fn(),
  sortTags: vi.fn((tags: Tag[]) => tags),
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

describe("TagPanel", () => {
  beforeEach(() => {
    tagsVersion.set(0);
    vi.clearAllMocks();
    vi.mocked(loadTags).mockReturnValue([]);
    vi.mocked(sortTags).mockImplementation((tags: Tag[]) => tags);
    vi.mocked(requestConfirm).mockResolvedValue(true);
  });

  describe("Рендеринг тегов", () => {
    it("показывает кнопку 'Новый тег', когда тегов нет", () => {
      render(TagPanel);

      expect(
        screen.getByRole("button", { name: /Новый тег/ }),
      ).toBeInTheDocument();
    });

    it("рендерит теги как кнопки", async () => {
      const tags = [
        makeTag({ id: "1", name: "Alpha Tag" }),
        makeTag({ id: "2", name: "Beta Tag" }),
      ];
      vi.mocked(loadTags).mockReturnValue(tags);

      render(TagPanel);

      expect(
        await screen.findByRole("button", {
          name: "Добавить тег Alpha Tag в промпт",
        }),
      ).toBeInTheDocument();

      expect(
        await screen.findByRole("button", {
          name: "Добавить тег Beta Tag в промпт",
        }),
      ).toBeInTheDocument();
    });

    it("показывает иконку звезды для избранных тегов", async () => {
      const tags = [makeTag({ id: "fav", name: "Fav Tag", favorite: true })];
      vi.mocked(loadTags).mockReturnValue(tags);

      const { container } = render(TagPanel);

      await screen.findByRole("button", {
        name: "Добавить тег Fav Tag в промпт",
      });

      // Иконка звезды рендерится как SVG внутри тега
      const starIcon = container.querySelector("svg");
      expect(starIcon).toBeInTheDocument();
    });

    it("сортирует теги через sortTags", async () => {
      const tags = [
        makeTag({ id: "1", name: "B Tag" }),
        makeTag({ id: "2", name: "A Tag" }),
      ];

      vi.mocked(sortTags).mockReturnValue([tags[1], tags[0]]);
      vi.mocked(loadTags).mockReturnValue(tags);

      render(TagPanel);

      await screen.findByRole("button", {
        name: "Добавить тег A Tag в промпт",
      });

      expect(sortTags).toHaveBeenCalledWith(tags);
    });
  });

  describe("Применение тега", () => {
    it("вставляет текст тега в редактор по клику", async () => {
      const editor = makeEditorMock();
      const tag = makeTag({
        id: "apply-1",
        name: "Apply Tag",
        value: "Apply this text",
      });
      vi.mocked(loadTags).mockReturnValue([tag]);

      render(TagPanel, {
        props: { editor: editor as any },
      });

      const tagButton = await screen.findByRole("button", {
        name: "Добавить тег Apply Tag в промпт",
      });

      await fireEvent.click(tagButton);

      expect(editor.chain).toHaveBeenCalled();
      expect(editor.focus).toHaveBeenCalled();
      expect(editor.insertContent).toHaveBeenCalledWith(
        "Apply this text\n",
      );
      expect(editor.run).toHaveBeenCalled();
    });

    it("добавляет перенос строки, если редактор не пустой", async () => {
      const editor = makeEditorMock();
      editor.getText.mockReturnValue("Existing text");

      const tag = makeTag({
        id: "apply-2",
        name: "Apply Tag",
        value: "New text",
      });
      vi.mocked(loadTags).mockReturnValue([tag]);

      render(TagPanel, {
        props: { editor: editor as any },
      });

      const tagButton = await screen.findByRole("button", {
        name: "Добавить тег Apply Tag в промпт",
      });

      await fireEvent.click(tagButton);

      expect(editor.insertContent).toHaveBeenCalledWith("\nNew text\n");
    });

    it("не добавляет перенос, если текст уже заканчивается переносом", async () => {
      const editor = makeEditorMock();
      editor.getText.mockReturnValue("Existing text\n");

      const tag = makeTag({
        id: "apply-3",
        name: "Apply Tag",
        value: "New text",
      });
      vi.mocked(loadTags).mockReturnValue([tag]);

      render(TagPanel, {
        props: { editor: editor as any },
      });

      const tagButton = await screen.findByRole("button", {
        name: "Добавить тег Apply Tag в промпт",
      });

      await fireEvent.click(tagButton);

      expect(editor.insertContent).toHaveBeenCalledWith("New text\n");
    });

    it("не вызывает ошибку, если редактор не передан", async () => {
      const tag = makeTag({ id: "no-editor", name: "No Editor Tag" });
      vi.mocked(loadTags).mockReturnValue([tag]);

      render(TagPanel, {
        props: { editor: null },
      });

      const tagButton = await screen.findByRole("button", {
        name: "Добавить тег No Editor Tag в промпт",
      });

      // Не должно бросать ошибку
      await fireEvent.click(tagButton);
    });
  });

describe("Кнопка 'Новый тег'", () => {
  it("открывает TagCreateModal по клику", async () => {
    render(TagPanel);

    const newTagButton = screen.getByRole("button", {
      name: /Новый тег/,
    });

    await fireEvent.click(newTagButton);

    // Модалка открылась — появилось поле ввода названия тега.
    // Это надёжнее, чем искать текст "Новый тег", который есть
    // и на кнопке, и в заголовке модалки.
    expect(
      await screen.findByLabelText("Название"),
    ).toBeInTheDocument();
  });
});

  describe("Редактирование тега", () => {
    it("открывает TagCreateModal с данными тега по клику на карандаш", async () => {
      const tag = makeTag({
        id: "edit-1",
        name: "Edit Tag",
        value: "Edit value",
      });
      vi.mocked(loadTags).mockReturnValue([tag]);

      render(TagPanel);

      await screen.findByRole("button", {
        name: "Добавить тег Edit Tag в промпт",
      });

      const editButton = screen.getByRole("button", {
        name: "Редактировать тег Edit Tag",
      });

      await fireEvent.click(editButton);

      // TagCreateModal должен открыться в режиме редактирования
      expect(
        await screen.findByText("Редактировать тег"),
      ).toBeInTheDocument();

      // Поля должны быть префиллены
      expect(screen.getByLabelText("Название")).toHaveValue("Edit Tag");
      expect(screen.getByLabelText("Текст инструкции")).toHaveValue(
        "Edit value",
      );
    });
  });

  describe("Обновление через tagsVersion", () => {
    it("обновляет список тегов при изменении tagsVersion", async () => {
      const initialTags = [makeTag({ id: "1", name: "Initial Tag" })];
      vi.mocked(loadTags).mockReturnValue(initialTags);

      render(TagPanel);

      await screen.findByRole("button", {
        name: "Добавить тег Initial Tag в промпт",
      });

      // Меняем теги и инкрементируем версию
      const updatedTags = [makeTag({ id: "2", name: "Updated Tag" })];
      vi.mocked(loadTags).mockReturnValue(updatedTags);

      tagsVersion.update((v) => v + 1);

      await waitFor(() => {
        expect(loadTags).toHaveBeenCalledTimes(2);
      });
    });
  });

describe("Создание тега через модалку", () => {
  it("вызывает addTag и обновляет список после создания", async () => {
    vi.mocked(loadTags).mockReturnValue([]);

    render(TagPanel);

    // Кнопку в панели ищем по роли и имени — это однозначно кнопка,
    // а не заголовок модалки.
    const newTagButton = screen.getByRole("button", {
      name: /Новый тег/,
    });
    await fireEvent.click(newTagButton);

    // Открытие модалки проверяем по полю формы.
    // Оно есть только внутри TagCreateModal, поэтому коллизий нет.
    const nameInput = await screen.findByLabelText("Название");

    await fireEvent.input(nameInput, {
      target: { value: "Created Tag" },
    });

    await fireEvent.input(screen.getByLabelText("Текст инструкции"), {
      target: { value: "Created value" },
    });

    await fireEvent.click(screen.getByText("Создать"));

    expect(addTag).toHaveBeenCalledWith("Created Tag", "Created value");
  });
});

  describe("Обновление тега через модалку", () => {
    it("вызывает updateTag при редактировании", async () => {
      const tag = makeTag({
        id: "update-1",
        name: "Original",
        value: "Original value",
      });
      vi.mocked(loadTags).mockReturnValue([tag]);

      render(TagPanel);

      await screen.findByRole("button", {
        name: "Добавить тег Original в промпт",
      });

      const editButton = screen.getByRole("button", {
        name: "Редактировать тег Original",
      });
      await fireEvent.click(editButton);

      await screen.findByText("Редактировать тег");

      await fireEvent.input(screen.getByLabelText("Название"), {
        target: { value: "Updated" },
      });
      await fireEvent.input(screen.getByLabelText("Текст инструкции"), {
        target: { value: "Updated value" },
      });

      await fireEvent.click(screen.getByText("Сохранить"));

      expect(updateTag).toHaveBeenCalledWith("update-1", "Updated", "Updated value");
    });
  });
});