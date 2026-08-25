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

  // Если в имени файла нет точки, считаем всё имя расширением (в нижнем регистре).
  // Это необходимо для корректной обработки файлов вроде Makefile (ожидание теста: "makefile").
  const ext = file.name.includes(".")
    ? file.name.split(".").pop()?.toLowerCase() || ""
    : file.name.toLowerCase();

  // Проверяем не только по расширению, но и по MIME-типу.
  // Это спасает от зависания в ветке Image для файлов без расширения, но с type="text/plain".
  const isText = isTextFile(file.name) || file.type.startsWith("text/");

  if (isText) {
    const content = await file.text();
    return {
      id,
      name: file.name,
      size: file.size,
      type: "text",
      content,
      ext,
    };
  } else {
    // Возвращаемся к стандартным FileReader и Image, чтобы тестовые моки
    // (которые перехватывают new Image() и new FileReader()) работали корректно.
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
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
