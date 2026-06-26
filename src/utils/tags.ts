import type { Tag } from '../types';
import { generateId } from './index';

const TAGS_KEY = 'tomte_tags_v1';

const DEFAULT_TAGS: Tag[] = [
  {
    id: 'default-1',
    name: '+ Инструкции для IDE',
    value:
      'Реализуй, только не отправляй измененную программу целиком, а дай четкие и понятные инструкции как мне изменить код в IDE (вставить сгенерированный код туда-то, вырезать что-то и т.д.).',
  },
  {
    id: 'default-2',
    name: '+ Только код',
    value: 'Пиши код без лишних комментариев и объяснений, только рабочий синтаксис.',
  },
];

export function loadTags(): Tag[] {
  try {
    const data = localStorage.getItem(TAGS_KEY);
    if (!data) {
      saveTags(DEFAULT_TAGS);
      return DEFAULT_TAGS;
    }
    return JSON.parse(data) as Tag[];
  } catch {
    return DEFAULT_TAGS;
  }
}

export function saveTags(tags: Tag[]): void {
  try {
    localStorage.setItem(TAGS_KEY, JSON.stringify(tags));
  } catch (error) {
    console.error('Failed to save tags:', error);
  }
}

export function addTag(name: string, value: string): Tag {
  const tag: Tag = { id: generateId(), name: name.trim(), value: value.trim() };
  const tags = loadTags();
  tags.push(tag);
  saveTags(tags);
  return tag;
}

export function removeTag(id: string): void {
  const tags = loadTags().filter((t) => t.id !== id);
  saveTags(tags);
}