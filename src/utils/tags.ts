import type { Tag } from "../types";

import { generateId } from "./index";

const TAGS_KEY = "tomte_tags_v1";

const DEFAULT_TAGS: Tag[] = [
  {
    id: "default-1",
    name: "Инструкции для IDE",
    value:
      "Реализуй, только не отправляй измененную программу целиком, а дай четкие и понятные инструкции как мне изменить код в IDE (вставить сгенерированный код туда-то, вырезать что-то и т.д.).",
    favorite: false,
    createdAt: new Date().toISOString(),
  },
  {
    id: "default-2",
    name: "Только код",
    value:
      "Пиши код без лишних комментариев и объяснений, только рабочий синтаксис.",
    favorite: false,
    createdAt: new Date().toISOString(),
  },
];

export function loadTags(): Tag[] {
  try {
    const data = localStorage.getItem(TAGS_KEY);
    if (!data) {
      saveTags(DEFAULT_TAGS);
      return DEFAULT_TAGS;
    }
    const tags = JSON.parse(data) as Tag[];
    return tags.map((t) => ({
      ...t,
      favorite: t.favorite ?? false,
      createdAt: t.createdAt ?? new Date().toISOString(),
    }));
  } catch {
    return DEFAULT_TAGS;
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
