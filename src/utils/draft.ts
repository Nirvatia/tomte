import type { Draft } from '../types';
import type { TreeNode } from './projectTree';

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
      console.error('localStorage quota exceeded. Очистите старые данные или используйте меньше вложений.');
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

// ====== Дерево проекта в IndexedDB ======
//
// Маленькие папки сохраняем вместе с содержимым файлов, чтобы после
// перезагрузки проект восстанавливался прямо из базы — без повторного
// выбора папки и без запросов разрешений.
// Большие папки держим только в памяти: их перечитывают заново
// или грузят через GitHub.

const DB_NAME = 'tomte-draft-db';
const STORE_NAME = 'project-source';
const SOURCE_KEY = 'root-source';

// Пороги «маленькой» папки.
const IDB_MAX_FILES = 300;
const IDB_MAX_BYTES = 25 * 1024 * 1024; // 25 MB

export interface PersistedProject {
  rootName: string;
  nodes: TreeNode[];
  savedAt: string;
}

export interface ProjectSourceInput {
  rootName: string;
  nodes: TreeNode[];
  fileCount: number;
}

function openProjectDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);

    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Делает копию дерева, где у каждого файла лежит реальный File с содержимым.
// Для папок из showDirectoryPicker это означает дочитать файлы — разрешение
// в момент сохранения ещё действует. Если суммарный размер вылезает за лимит,
// возвращает null, и такая папка в базу не попадает.
async function materializeFiles(nodes: TreeNode[]): Promise<TreeNode[] | null> {
  let totalBytes = 0;

  async function walk(items: TreeNode[]): Promise<TreeNode[] | null> {
    const result: TreeNode[] = [];

    for (const item of items) {
      if (item.type === 'directory') {
        const children = await walk(item.children);
        if (!children) return null;
        result.push({ ...item, children });
        continue;
      }

      let file = item.fileRef;

      if (file && !(file instanceof File)) {
        try {
          file = await (file as FileSystemFileHandle).getFile();
        } catch {
          file = undefined;
        }
      }

      if (file instanceof File) {
        totalBytes += file.size;
        if (totalBytes > IDB_MAX_BYTES) return null;
      }

      result.push({ ...item, fileRef: file });
    }

    return result;
  }

  return walk(nodes);
}

export async function saveProjectSource(source: ProjectSourceInput): Promise<boolean> {
  // Большую папку не сохраняем. Старую запись убираем, чтобы после
  // перезагрузки не всплыл устаревший проект.
  if (source.fileCount > IDB_MAX_FILES) {
    await clearProjectSource();
    return false;
  }

  const nodes = await materializeFiles(source.nodes);
  if (!nodes) {
    await clearProjectSource();
    return false;
  }

  const payload: PersistedProject = {
    rootName: source.rootName,
    nodes,
    savedAt: new Date().toISOString(),
  };

  try {
    const db = await openProjectDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(payload, SOURCE_KEY);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.warn('saveProjectSource failed:', e);
    return false;
  }
}

export async function loadProjectSource(): Promise<PersistedProject | null> {
  try {
    const db = await openProjectDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(SOURCE_KEY);

      req.onsuccess = () => {
        const value = req.result ?? null;
        // Старый формат (handle / files) больше не поддерживаем.
        if (value && Array.isArray(value.nodes)) resolve(value);
        else resolve(null);
      };
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.warn('loadProjectSource failed:', e);
    return null;
  }
}

export async function clearProjectSource(): Promise<void> {
  try {
    const db = await openProjectDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(SOURCE_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.warn('clearProjectSource failed:', e);
  }
}