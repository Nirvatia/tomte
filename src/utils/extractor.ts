import type { AttachedFile } from "../types";
import { generateId } from "./index";

export interface ExtractedFile {
  id: string;
  name: string;
  lang: string;
  code: string;
}

const FILE_PATTERNS = [
  /FILE:\s*["']?([a-zA-Z0-9_\-./\\]+\.[a-zA-Z0-9]+)["']?/i,
  /<file\s+name=["']([^"']+)["']/i,
  /\/\/\s*FILE:\s*["']?([a-zA-Z0-9_\-./\\]+\.[a-zA-Z0-9]+)["']?/i,
  /\*\*([a-zA-Z0-9_\-./\\]+\.[a-zA-Z0-9]+)\*\*/i,
  /`([a-zA-Z0-9_\-./\\]+\.[a-zA-Z0-9]+)`/i,
  /^([a-zA-Z0-9_\-./\\]+\.[a-zA-Z0-9]+):\s*$/m,
  /File:\s*["']?([a-zA-Z0-9_\-./\\]+\.[a-zA-Z0-9]+)["']?/i,
  /^\s*([a-zA-Z0-9_\-./\\]+\.[a-zA-Z0-9]+)\s*$/m,
];

const LANG_EXT_MAP: Record<string, string> = {
  javascript: "js",
  js: "js",
  typescript: "ts",
  ts: "ts",
  python: "py",
  py: "py",
  html: "html",
  css: "css",
  java: "java",
  cpp: "cpp",
  c: "c",
  "c#": "cs",
  csharp: "cs",
  php: "php",
  ruby: "rb",
  go: "go",
  rust: "rs",
  json: "json",
  xml: "xml",
  yaml: "yaml",
  yml: "yml",
  sql: "sql",
  bash: "sh",
  sh: "sh",
  markdown: "md",
  md: "md",
  txt: "txt",
  svelte: "svelte",
  gdscript: "gd"
};

function findFileName(text: string): string | null {
  for (const pattern of FILE_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      return match[1].replace(/\\/g, "/").trim();
    }
  }
  return null;
}

export function extractFilesFromMarkdown(markdown: string): ExtractedFile[] {
  const extracted: ExtractedFile[] = [];
  const blockRegex = /```([a-zA-Z0-9_+\-#. ]*)\s*\n?([\s\S]*?)```/g;
  let match;
  let fileCounter = 1;

  while ((match = blockRegex.exec(markdown)) !== null) {
    const lang = match[1].trim().toLowerCase();
    let code = match[2].trim();

    // Убираем лишние отступы
    code = code.replace(/^[\t ]+/gm, "");

    let fileName: string | null = null;

    // Ищем в тексте ДО блока (500 символов)
    const precedingText = markdown.substring(
      Math.max(0, match.index - 500),
      match.index,
    );
    fileName = findFileName(precedingText);

    // Если не нашли — в тексте ПОСЛЕ блока (300 символов)
    if (!fileName) {
      const followingText = markdown.substring(
        match.index + match[0].length,
        match.index + match[0].length + 300,
      );
      fileName = findFileName(followingText);
    }

    // Если не нашли — в первых строках кода
    if (!fileName) {
      const codeLines = code.split("\n").slice(0, 5).join("\n");
      fileName = findFileName(codeLines);
    }

    // Если совсем не нашли — генерируем из языка
    if (!fileName) {
      const ext = LANG_EXT_MAP[lang] || "txt";
      fileName = `file_${fileCounter}.${ext}`;
    }

    extracted.push({
      id: generateId(),
      name: fileName,
      lang: lang || "text",
      code,
    });

    fileCounter++;
  }

  return extracted;
}

export function convertToAttachedFile(extracted: ExtractedFile): AttachedFile {
  return {
    id: extracted.id,
    name: extracted.name,
    size: extracted.code.length,
    type: "text",
    content: extracted.code,
    ext: extracted.name.split(".").pop()?.toLowerCase() || "txt",
    includeInExport: false,
  };
}

export function createZipBlob(files: ExtractedFile[]): Blob {
  // Простая реализация ZIP без внешних библиотек
  // Для production лучше использовать jszip или fflate
  const encoder = new TextEncoder();
  const parts: BlobPart[] = [];

  files.forEach((file) => {
    const content = encoder.encode(file.code);
    parts.push(new Blob([content], { type: "text/plain" }));
  });

  return new Blob(parts, { type: "application/zip" });
}

export function downloadFile(content: string, filename: string): void {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadAllAsIndividualFiles(files: ExtractedFile[]): void {
  files.forEach((file) => {
    downloadFile(file.code, file.name);
  });
}
