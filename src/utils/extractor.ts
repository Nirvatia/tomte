import { zipSync, strToU8 } from "fflate";

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
  gdscript: "gd",
};

function findFileName(text: string): string | null {
  for (const pattern of FILE_PATTERNS) {
    const match = text.match(pattern);
    if (match) return match[1].replace(/\\/g, "/").trim();
  }
  return null;
}

function normalizeMarkdown(text: string): string {
  return text.replace(/['']/g, "'").replace(/[""]/g, '"');
}

export function extractFilesFromMarkdown(markdown: string): ExtractedFile[] {
  const normalizedMarkdown = normalizeMarkdown(markdown);
  const extracted: ExtractedFile[] = [];
  const usedNames = new Set<string>();
  const blockRegex =
    /(?:^|\n)\s*```([a-zA-Z0-9_+\-#]+)\s*\r?\n([\s\S]*?)\r?\n\s*```/g;

  let match;
  let fileCounter = 1;

  while ((match = blockRegex.exec(normalizedMarkdown)) !== null) {
    const lang = match[1].trim().toLowerCase();
    let code = match[2].trim();

    if (code.length < 15 && !code.includes("\n") && !lang) {
      continue;
    }

    let fileName: string | null = null;
    fileName = findFileName(
      normalizedMarkdown.substring(Math.max(0, match.index - 500), match.index),
    );

    if (!fileName) {
      fileName = findFileName(
        normalizedMarkdown.substring(
          match.index + match[0].length,
          match.index + match[0].length + 300,
        ),
      );
    }

    if (!fileName) {
      fileName = findFileName(code.split("\n").slice(0, 5).join("\n"));
    }

    if (!fileName) {
      const ext = LANG_EXT_MAP[lang] || "txt";
      fileName = `file_${fileCounter}.${ext}`;
    }

    let uniqueName = fileName;
    let counter = 1;

    while (usedNames.has(uniqueName)) {
      const lastDot = fileName.lastIndexOf(".");
      if (lastDot > 0) {
        const baseName = fileName.substring(0, lastDot);
        const ext = fileName.substring(lastDot);
        uniqueName = `${baseName}_${counter}${ext}`;
      } else {
        uniqueName = `${fileName}_${counter}`;
      }
      counter++;
    }

    usedNames.add(uniqueName);
    extracted.push({
      id: generateId(),
      name: uniqueName,
      lang: lang,
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
  };
}

export function createZipBlob(files: ExtractedFile[]): Blob {
  const zipData: Record<string, Uint8Array> = {};
  files.forEach((file) => {
    zipData[file.name] = strToU8(file.code);
  });
  const zipped = zipSync(zipData);
  return new Blob([zipped], { type: "application/zip" });
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
