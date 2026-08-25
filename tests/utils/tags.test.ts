import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  loadTags,
  saveTags,
  addTag,
  updateTag,
  removeTag,
  removeTags,
  toggleFavorite,
  sortTags,
} from "../../src/utils/tags";
import type { Tag } from "../../src/types";

const TAGS_KEY = "tomte_tags_v1";

function makeTag(partial: Partial<Tag> & { id: string; name: string }): Tag {
  return {
    value: "",
    favorite: false,
    createdAt: new Date().toISOString(),
    ...partial,
  };
}

describe("tags", () => {
  let storage: Record<string, string>;

  beforeEach(() => {
    storage = {};
    vi.stubGlobal("localStorage", {
      getItem: vi.fn((key: string) => storage[key] ?? null),
      setItem: vi.fn((key: string, value: string) => {
        storage[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete storage[key];
      }),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("loadTags", () => {
    it("возвращает дефолтные теги если хранилище пустое", () => {
      const tags = loadTags();

      expect(tags.length).toBeGreaterThanOrEqual(2);
      expect(tags.some((t) => t.name === "Инструкции для IDE")).toBe(true);
      expect(tags.some((t) => t.name === "Только код")).toBe(true);
    });

    it("сохраняет дефолтные теги при первом запуске", () => {
      loadTags();

      expect(localStorage.setItem).toHaveBeenCalled();
      expect(storage[TAGS_KEY]).toBeTruthy();
    });

    it("загружает сохранённые теги", () => {
      const saved = [makeTag({ id: "1", name: "Тест", value: "текст" })];
      storage[TAGS_KEY] = JSON.stringify(saved);

      const tags = loadTags();

      expect(tags).toHaveLength(1);
      expect(tags[0].name).toBe("Тест");
      expect(tags[0].value).toBe("текст");
    });

    it("добавляет дефолтные поля старым тегам при миграции", () => {
      const oldTag = { id: "1", name: "Старый", value: "текст" };
      storage[TAGS_KEY] = JSON.stringify([oldTag]);

      const tags = loadTags();

      expect(tags[0].favorite).toBe(false);
      expect(tags[0].createdAt).toBeTruthy();
    });

    it("возвращает дефолтные теги при повреждённых данных", () => {
      storage[TAGS_KEY] = "не валидный json{{{";

      const tags = loadTags();

      expect(tags.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("saveTags", () => {
    it("сохраняет теги в localStorage", () => {
      const tags = [makeTag({ id: "1", name: "Тест", value: "текст" })];

      saveTags(tags);

      const saved = JSON.parse(storage[TAGS_KEY]);
      expect(saved).toHaveLength(1);
      expect(saved[0].name).toBe("Тест");
    });
  });

  describe("addTag", () => {
    it("добавляет новый тег", () => {
      const tag = addTag("Новый тег", "Инструкция");

      expect(tag.name).toBe("Новый тег");
      expect(tag.value).toBe("Инструкция");
      expect(tag.favorite).toBe(false);
      expect(tag.id).toBeTruthy();
    });

    it("обрезает пробелы в имени и значении", () => {
      const tag = addTag("  Тег  ", "  Текст  ");

      expect(tag.name).toBe("Тег");
      expect(tag.value).toBe("Текст");
    });

    it("сохраняет тег в localStorage", () => {
      addTag("Тег", "Текст");

      const saved = JSON.parse(storage[TAGS_KEY]);
      expect(saved.some((t: any) => t.name === "Тег")).toBe(true);
    });
  });

  describe("updateTag", () => {
    it("обновляет существующий тег", () => {
      addTag("Старый", "Старый текст");
      const tags = loadTags();
      const id = tags.find((t) => t.name === "Старый")!.id;

      updateTag(id, "Новый", "Новый текст");

      const updated = loadTags();
      const tag = updated.find((t) => t.id === id)!;
      expect(tag.name).toBe("Новый");
      expect(tag.value).toBe("Новый текст");
    });

    it("не трогает другие теги", () => {
      addTag("Первый", "Текст 1");
      addTag("Второй", "Текст 2");
      const tags = loadTags();
      const id = tags.find((t) => t.name === "Первый")!.id;

      updateTag(id, "Изменённый", "Новый текст");

      const updated = loadTags();
      expect(updated.find((t) => t.name === "Второй")).toBeTruthy();
    });
  });

  describe("removeTag", () => {
    it("удаляет тег по id", () => {
      addTag("Удаляемый", "Текст");
      const tags = loadTags();
      const id = tags.find((t) => t.name === "Удаляемый")!.id;

      removeTag(id);

      const remaining = loadTags();
      expect(remaining.find((t) => t.id === id)).toBeUndefined();
    });
  });

  describe("removeTags", () => {
    it("удаляет несколько тегов по набору id", () => {
      addTag("Первый", "Текст 1");
      addTag("Второй", "Текст 2");
      addTag("Третий", "Текст 3");
      const tags = loadTags();
      const idsToRemove = new Set(
        tags.filter((t) => t.name === "Первый" || t.name === "Второй").map((t) => t.id),
      );

      removeTags(idsToRemove);

      const remaining = loadTags();
      expect(remaining.find((t) => t.name === "Первый")).toBeUndefined();
      expect(remaining.find((t) => t.name === "Второй")).toBeUndefined();
      expect(remaining.find((t) => t.name === "Третий")).toBeTruthy();
    });

    it("ничего не делает для пустого набора", () => {
      addTag("Единственный", "Текст");
      const before = loadTags().length;

      removeTags(new Set());

      expect(loadTags().length).toBe(before);
    });
  });

  describe("toggleFavorite", () => {
    it("переключает статус избранного", () => {
      addTag("Тег", "Текст");
      const tags = loadTags();
      const id = tags.find((t) => t.name === "Тег")!.id;

      expect(tags.find((t) => t.id === id)!.favorite).toBe(false);

      toggleFavorite(id);
      expect(loadTags().find((t) => t.id === id)!.favorite).toBe(true);

      toggleFavorite(id);
      expect(loadTags().find((t) => t.id === id)!.favorite).toBe(false);
    });
  });

  describe("sortTags", () => {
    it("избранные теги идут первыми", () => {
      const tags: Tag[] = [
        makeTag({ id: "1", name: "Обычный" }),
        makeTag({ id: "2", name: "Избранный", favorite: true }),
        makeTag({ id: "3", name: "Ещё обычный" }),
      ];

      const sorted = sortTags(tags);

      expect(sorted[0].name).toBe("Избранный");
    });

    it("внутри группы сортирует по алфавиту", () => {
      const tags: Tag[] = [
        makeTag({ id: "1", name: "Яблоко" }),
        makeTag({ id: "2", name: "Арбуз" }),
        makeTag({ id: "3", name: "Банан" }),
      ];

      const sorted = sortTags(tags);

      expect(sorted[0].name).toBe("Арбуз");
      expect(sorted[1].name).toBe("Банан");
      expect(sorted[2].name).toBe("Яблоко");
    });

    it("не мутирует исходный массив", () => {
      const tags: Tag[] = [
        makeTag({ id: "1", name: "Б" }),
        makeTag({ id: "2", name: "А" }),
      ];

      sortTags(tags);

      expect(tags[0].name).toBe("Б");
    });
  });
});