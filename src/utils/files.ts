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
  "gd",
];

export function isTextFile(filename: string): boolean {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  return TEXT_EXTENSIONS.includes(ext);
}

export function getPlaceholderPrefix(file: AttachedFile): string {
  return file.type === "image" ? "IMAGE" : "FILE";
}

/** Номер среди вложений с тем же префиксом: [IMAGE_n] и [FILE_n] нумеруются отдельно. */
export function getPlaceholderIndex(
  file: AttachedFile,
  allFiles: AttachedFile[],
): number {
  const prefix = getPlaceholderPrefix(file);
  let index = 1;
  for (const f of allFiles) {
    if (f.id === file.id) return index;
    if (getPlaceholderPrefix(f) === prefix) index++;
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

const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg", "avif", "ico"];

function getExtension(name: string): string {
  // Без точки всё имя считается расширением: Makefile -> "makefile".
  return name.includes(".")
    ? name.split(".").pop()?.toLowerCase() || ""
    : name.toLowerCase();
}

function isImageFile(file: File, ext: string): boolean {
  return file.type.startsWith("image/") || (!file.type && IMAGE_EXTENSIONS.includes(ext));
}

export function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("Не удалось прочитать файл"));
    reader.readAsDataURL(file);
  });
}

export async function measureImage(
  src: string,
): Promise<{ width: number; height: number }> {
  const img = new Image();
  img.src = src;
  await img.decode();
  return { width: img.naturalWidth, height: img.naturalHeight };
}

/**
 * Превращает File во вложение:
 *  - текст (по расширению или MIME text/*) — с содержимым;
 *  - картинка — data URL и размеры;
 *  - всё остальное (PDF, архивы, битые картинки) — только метаданные.
 */
export async function processFile(file: File): Promise<AttachedFile> {
  const ext = getExtension(file.name);
  const base = { id: generateId(), name: file.name, size: file.size, ext };

  if (isTextFile(file.name) || file.type.startsWith("text/")) {
    return { ...base, type: "text", content: await file.text() };
  }

  if (isImageFile(file, ext)) {
    try {
      const dataUrl = await readAsDataUrl(file);
      const { width, height } = await measureImage(dataUrl);
      return { ...base, type: "image", dataUrl, width, height };
    } catch (error) {
      console.warn(`Не удалось прочитать изображение ${file.name}:`, error);
    }
  }

  return { ...base, type: "binary" };
}
