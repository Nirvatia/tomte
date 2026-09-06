import type { AttachedFile } from "../types";
import type { TreeNode } from "./projectTree";
import { fetchGithubFileContent } from "./github";

/**
 * Оценка токенов финального промпта для StatusBar.
 *
 * Эвристика без тяжёлых токенизаторов:
 * - английский текст ≈ 4 символа/токен, русский ≈ 2 символа/токен;
 *   «символов на токен» интерполируется по доле кириллицы;
 * - изображения исключены из расчёта.
 */

const CHARS_PER_TOKEN_EN = 4;
const CHARS_PER_TOKEN_RU = 2;

export function estimateTokens(text: string): number {
  if (!text) return 0;
  let cyrillicChars = 0;
  for (const char of text) {
    const code = char.codePointAt(0);
    if (code !== undefined && code >= 0x0400 && code <= 0x04ff) {
      cyrillicChars += 1;
    }
  }
  const cyrillicRatio = cyrillicChars / text.length;
  const charsPerToken =
    CHARS_PER_TOKEN_EN -
    (CHARS_PER_TOKEN_EN - CHARS_PER_TOKEN_RU) * cyrillicRatio;
  return Math.max(1, Math.round(text.length / charsPerToken));
}

/** Достаёт видимый текст из HTML редактора. */
export function htmlToPlainText(html: string): string {
  if (!html || !html.trim()) return "";
  const doc = new DOMParser().parseFromString(html, "text/html");
  return doc.body.textContent ?? "";
}

export function estimateHtmlTokens(html: string): number {
  return estimateTokens(htmlToPlainText(html));
}

/**
 * Оценка токенов вложения.
 * Изображения исключены из расчёта (0).
 */
export function estimateAttachmentTokens(file: AttachedFile): number {
  if (file.type === "image") return 0;
  if (typeof file.content === "string") {
    return estimateTokens(file.content);
  }
  // Только метаданные: грубая оценка от размера в байтах
  return Math.max(1, Math.round(file.size / 3.5));
}

// ─── Кэш файлов дерева ────────────────────────────────────────────
// path -> токены. Содержимое файла читается один раз; все дальнейшие
// клики по чекбоксам обходятся без диска/сети.
const treeTokenCache = new Map<string, number>();

export function resetTreeTokenCache(): void {
  treeTokenCache.clear();
}

export function getCachedTreeTokens(path: string): number | undefined {
  return treeTokenCache.get(path);
}

/**
 * Читает содержимое файла дерева и возвращает оценку токенов.
 * Результат кэшируется. Ошибки чтения НЕ кэшируются —
 * повторная попытка будет при следующем пересчёте.
 */
export async function loadTreeFileTokens(node: TreeNode): Promise<number> {
  const cached = treeTokenCache.get(node.path);
  if (cached !== undefined) return cached;

  try {
    let content = "";
    if (node.fileRef) {
      if (node.fileRef instanceof File) {
        content = await node.fileRef.text();
      } else {
        const file = await (node.fileRef as FileSystemFileHandle).getFile();
        content = await file.text();
      }
    } else if (node.githubRef) {
      const githubFile = await fetchGithubFileContent(node);
      content = githubFile.content;
    } else {
      // Содержимого нет (только метаданные) — 0 и не повторять
      treeTokenCache.set(node.path, 0);
      return 0;
    }
    const tokens = estimateTokens(content);
    treeTokenCache.set(node.path, tokens);
    return tokens;
  } catch (error) {
    console.warn(`Не удалось прочитать файл дерева ${node.path}:`, error);
    return 0;
  }
}