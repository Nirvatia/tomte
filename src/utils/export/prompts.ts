import { zipSync, strToU8 } from "fflate";

import type { PromptFile } from "../../types";
import { sanitizeFileName } from "../index";
import { downloadBlob } from "./common";
import { htmlToMarkdown } from "./md";

/** Имя .md для файла промпта, без повторов внутри архива. */
function uniqueMarkdownName(name: string, used: Set<string>): string {
  const stem = sanitizeFileName(name.replace(/\.md$/i, ""));
  let candidate = `${stem}.md`;
  for (let counter = 2; used.has(candidate.toLowerCase()); counter++) {
    candidate = `${stem} (${counter}).md`;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}

/** Собирает ZIP, где каждый файл промпта лежит отдельным Markdown-файлом. */
export function buildPromptsZip(files: PromptFile[]): Uint8Array {
  const used = new Set<string>();
  const entries: Record<string, Uint8Array> = {};
  for (const file of files) {
    entries[uniqueMarkdownName(file.name, used)] = strToU8(
      htmlToMarkdown(file.content),
    );
  }
  return zipSync(entries);
}

export function exportPromptsToZip(files: PromptFile[], zipName: string): void {
  const zipped = buildPromptsZip(files);
  const blob = new Blob([zipped as BlobPart], { type: "application/zip" });
  downloadBlob(blob, `${sanitizeFileName(zipName)}.zip`);
}
