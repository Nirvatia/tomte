import { translate } from "$lib/i18n";
import type { Tag } from "../types";

import { generateId } from "./index";

const TAGS_KEY = "tomte_tags_v1";

/** Теги при первом запуске: на языке интерфейса, дальше это данные пользователя. */
function defaultTags(): Tag[] {
  const now = new Date().toISOString();
  return [
    {
      id: "default-1",
      name: translate("tags.defaults.ide.name"),
      value: translate("tags.defaults.ide.value"),
      favorite: false,
      createdAt: now,
    },
    {
      id: "default-2",
      name: translate("tags.defaults.codeOnly.name"),
      value: translate("tags.defaults.codeOnly.value"),
      favorite: false,
      createdAt: now,
    },
  ];
}

export function loadTags(): Tag[] {
  try {
    const data = localStorage.getItem(TAGS_KEY);
    if (!data) {
      const initial = defaultTags();
      saveTags(initial);
      return initial;
    }
    const tags = JSON.parse(data) as Tag[];
    return tags.map((t) => ({
      ...t,
      favorite: t.favorite ?? false,
      createdAt: t.createdAt ?? new Date().toISOString(),
    }));
  } catch {
    return defaultTags();
  }
}

export function saveTags(tags: Tag[]): void {
  try {
    localStorage.setItem(TAGS_KEY, JSON.stringify(tags));
  } catch (error) {
    console.error("Failed to save tags:", error);
  }
}

export function addTag(name: string, value: string): Tag {
  const tag: Tag = {
    id: generateId(),
    name: name.trim(),
    value: value.trim(),
    favorite: false,
    createdAt: new Date().toISOString(),
  };
  const tags = loadTags();
  tags.push(tag);
  saveTags(tags);
  return tag;
}

export function updateTag(id: string, name: string, value: string): void {
  const tags = loadTags();
  const updatedTags = tags.map((t) =>
    t.id === id ? { ...t, name: name.trim(), value: value.trim() } : t,
  );
  saveTags(updatedTags);
}

export function removeTag(id: string): void {
  const tags = loadTags().filter((t) => t.id !== id);
  saveTags(tags);
}

/** Удаляет тег и возвращает функцию, которая вернёт его на прежнее место. */
export function removeTagWithUndo(id: string): (() => void) | null {
  const tags = loadTags();
  const index = tags.findIndex((t) => t.id === id);
  if (index < 0) return null;
  const [tag] = tags.splice(index, 1);
  saveTags(tags);

  return () => {
    const current = loadTags();
    if (current.some((t) => t.id === tag.id)) return;
    current.splice(Math.min(index, current.length), 0, tag);
    saveTags(current);
  };
}

export function removeTags(ids: Set<string>): void {
  const tags = loadTags().filter((t) => !ids.has(t.id));
  saveTags(tags);
}

export function toggleFavorite(id: string): void {
  const tags = loadTags();
  const updatedTags = tags.map((t) =>
    t.id === id ? { ...t, favorite: !t.favorite } : t,
  );
  saveTags(updatedTags);
}

export function sortTags(tags: Tag[]): Tag[] {
  return [...tags].sort((a, b) => {
    if (a.favorite && !b.favorite) return -1;
    if (!a.favorite && b.favorite) return 1;
    return a.name.localeCompare(b.name, "ru");
  });
}
