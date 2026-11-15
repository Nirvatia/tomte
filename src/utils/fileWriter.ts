import { diffLines, countChanges } from "./diff";

/**
 * Этап 10.5. Запись экстрактора на диск через File System Access API.
 * Запись идёт в выбранную пользователем папку (режим readwrite);
 * перед записью показываем план: что новое, что изменилось и насколько.
 */

export interface WritePlanItem {
  path: string;
  content: string;
  status: "new" | "changed" | "same";
  added: number;
  removed: number;
}

export interface PlanInput {
  name: string;
  code: string;
}

export function isFolderWriteSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.showDirectoryPicker === "function"
  );
}

/** Просит папку на запись. null, если пользователь отменил выбор. */
export async function pickWritableFolder(): Promise<FileSystemDirectoryHandle | null> {
  if (!window.showDirectoryPicker) return null;
  try {
    return await window.showDirectoryPicker({ mode: "readwrite" });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return null;
    }
    throw error;
  }
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\/+/, "");
}

/** Содержимое файла в папке. null, если файла нет или прочитать не удалось. */
export async function readFolderFile(
  dir: FileSystemDirectoryHandle,
  path: string,
): Promise<string | null> {
  const parts = normalizePath(path).split("/").filter(Boolean);
  if (parts.length === 0) return null;
  let current: FileSystemDirectoryHandle = dir;
  try {
    for (let i = 0; i < parts.length - 1; i++) {
      current = await current.getDirectoryHandle(parts[i]);
    }
    const handle = await current.getFileHandle(parts[parts.length - 1]);
    return await (await handle.getFile()).text();
  } catch {
    return null;
  }
}

/** Сверяет извлечённые файлы с папкой: статус и размер изменений каждого. */
export async function planFolderWrite(
  dir: FileSystemDirectoryHandle,
  files: PlanInput[],
): Promise<WritePlanItem[]> {
  const plan: WritePlanItem[] = [];
  for (const file of files) {
    const path = normalizePath(file.name);
    const existing = await readFolderFile(dir, path);
    if (existing === null) {
      plan.push({
        path,
        content: file.code,
        status: "new",
        added: file.code === "" ? 0 : file.code.split("\n").length,
        removed: 0,
      });
    } else if (existing === file.code) {
      plan.push({
        path,
        content: file.code,
        status: "same",
        added: 0,
        removed: 0,
      });
    } else {
      const { added, removed } = countChanges(diffLines(existing, file.code));
      plan.push({
        path,
        content: file.code,
        status: "changed",
        added,
        removed,
      });
    }
  }
  return plan;
}

/** Пишет файл в папку, создавая недостающие каталоги по пути. */
export async function writeFolderFile(
  dir: FileSystemDirectoryHandle,
  path: string,
  content: string,
): Promise<void> {
  const parts = normalizePath(path).split("/").filter(Boolean);
  if (parts.length === 0) throw new Error("empty path");
  let current: FileSystemDirectoryHandle = dir;
  for (let i = 0; i < parts.length - 1; i++) {
    current = await current.getDirectoryHandle(parts[i], { create: true });
  }
  const handle = await current.getFileHandle(parts[parts.length - 1], {
    create: true,
  });
  const writable = await handle.createWritable();
  await writable.write(content);
  await writable.close();
}
