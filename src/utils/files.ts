import type { AttachedFile } from "../types";
import { generateId } from "./index";

export const TEXT_EXTENSIONS = [
  "txt",
  "md",
  "py",
  "js",
  "html",
  "css",
  "json",
  "xml",
  "csv",
  "sql",
  "java",
  "cpp",
  "c",
  "h",
  "php",
  "rb",
  "go",
  "rs",
  "ts",
  "jsx",
  "tsx",
  "yaml",
  "yml",
  "svelte",
  "gd"
];

export function isTextFile(filename: string): boolean {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  return TEXT_EXTENSIONS.includes(ext);
}

export function getPlaceholderPrefix(file: AttachedFile): string {
  return file.type === "image" ? "IMAGE" : "FILE";
}

export function getPlaceholderIndex(
  file: AttachedFile,
  allFiles: AttachedFile[],
): number {
  let index = 1;
  for (const f of allFiles) {
    if (f.id === file.id) return index;
    if (f.type === file.type) index++;
  }
  return index;
}

export function getPlaceholder(
  file: AttachedFile,
  allFiles: AttachedFile[],
): string {
  const prefix = getPlaceholderPrefix(file);
  const index = getPlaceholderIndex(file, allFiles);
  return `[${prefix}_${index}: ${file.name}]`;
}

export async function processFile(file: File): Promise<AttachedFile> {
  const id = generateId();
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  const isText = isTextFile(file.name);

  if (isText) {
    const content = await file.text();
    return {
      id,
      name: file.name,
      size: file.size,
      type: "text",
      content,
      ext,
      includeInExport: false,
    };
  } else {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        const img = new Image();
        img.onload = () => {
          resolve({
            id,
            name: file.name,
            size: file.size,
            type: "image",
            dataUrl,
            ext,
            width: img.naturalWidth,
            height: img.naturalHeight,
            includeInExport: false,
          });
        };
        img.onerror = reject;
        img.src = dataUrl;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
}
/**
 * Рекурсивно читает файлы из DataTransferItemList при drag-and-drop.
 * Поддерживает как обычные файлы, так и папки (рекурсивно).
 */
export async function readDroppedFiles(items: DataTransferItemList): Promise<File[]> {
  const result: File[] = [];

  // Собираем все entries
  const entries: FileSystemEntry[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    // getAsEntry — нестандартный, но широко поддерживаемый API
    const entry = (item as any).webkitGetAsEntry?.() || (item as any).getAsEntry?.();
    if (entry) {
      entries.push(entry);
    }
  }

  // Рекурсивный обход
  async function traverse(entry: FileSystemEntry): Promise<void> {
    if (entry.isFile) {
      const file = await new Promise<File>((resolve, reject) => {
        (entry as FileSystemFileEntry).file(resolve, reject);
      });
      result.push(file);
    } else if (entry.isDirectory) {
      const reader = (entry as FileSystemDirectoryEntry).createReader();
      const entriesInDir = await new Promise<FileSystemEntry[]>((resolve, reject) => {
        const all: FileSystemEntry[] = [];
        const readBatch = () => {
          reader.readEntries(
            (batch) => {
              if (batch.length === 0) {
                resolve(all);
              } else {
                all.push(...batch);
                readBatch();
              }
            },
            reject
          );
        };
        readBatch();
      });

      for (const child of entriesInDir) {
        await traverse(child);
      }
    }
  }

  for (const entry of entries) {
    await traverse(entry);
  }

  return result;
}

/**
 * Проверяет, можно ли прочитать файл
 */
export async function isFileReadable(file: File): Promise<boolean> {
  try {
    // Пробуем прочитать первые 0 байт - это быстрая проверка
    await file.slice(0, 0).text();
    return true;
  } catch {
    return false;
  }
}
