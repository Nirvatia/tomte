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
