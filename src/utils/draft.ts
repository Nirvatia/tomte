import type { Draft } from '../types';

const DRAFT_KEY = 'tomte_draft_v1';
const CURRENT_VERSION = '1.0';

export function saveDraft(data: Omit<Draft, 'savedAt' | 'version'>): void {
  try {
    const draft: Draft = {
      ...data,
      savedAt: new Date().toISOString(),
      version: CURRENT_VERSION,
    };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch (error) {
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      console.error('localStorage quota exceeded');
      // Можно показать уведомление пользователю
    } else {
      console.error('Failed to save draft:', error);
    }
  }
}

export function loadDraft(): Draft | null {
  try {
    const data = localStorage.getItem(DRAFT_KEY);
    if (!data) return null;

    const draft = JSON.parse(data) as Draft;

    // Проверка версии для будущих миграций
    if (draft.version !== CURRENT_VERSION) {
      console.warn('Draft version mismatch, clearing old draft');
      clearDraft();
      return null;
    }

    return draft;
  } catch (error) {
    console.error('Failed to load draft:', error);
    return null;
  }
}

export function clearDraft(): void {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch (error) {
    console.error('Failed to clear draft:', error);
  }
}

export function hasDraft(): boolean {
  return localStorage.getItem(DRAFT_KEY) !== null;
}

export function formatDraftTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'только что';
  if (diffMins < 60) return `${diffMins} мин. назад`;
  if (diffHours < 24) return `${diffHours} ч. назад`;
  if (diffDays < 7) return `${diffDays} дн. назад`;

  return date.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}