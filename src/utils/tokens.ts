import type { AttachedFile } from "../types";
import type { TreeNode } from "./projectTree";
import { fetchGithubFileContent } from "./github";
import { logWarn } from "$lib/log";

/**
 * Оценка токенов финального промпта для StatusBar.
 *
 * Эвристика без токенайзера: у каждого класса символов свой вес «токенов
 * на символ». Раньше считали одним числом «символов на токен» (4 для
 * латиницы, 2 для кириллицы), и плотные данные (JSON, CSS, минифицированный
 * код: много цифр и знаков) занижались на 20–35%.
 *
 * Веса подогнаны регрессией по ~700 фрагментам реальных файлов (код,
 * JSON, CSS/HTML, Markdown, русский текст) против токенайзеров OpenAI
 * o200k и cl100k, усреднённых: токенайзера Claude и Gemini офлайн нет,
 * поэтому результат — оценка, а не точный счёт. На отложенных файлах
 * медианная ошибка около 6%, 90-й перцентиль около 15% (было 8% и 31%).
 * Длинные строки из букв и цифр без разделителей (хеши, base64, ключи)
 * токенизируются почти посимвольно, поэтому получают доплату.
 * Слабые места: редкие письменности и эмодзи считаются грубо.
 * Кириллица оставлена консервативной (около 2,2 символа на токен):
 * токенайзеры Claude на русском тяжелее o200k.
 *
 * Изображения и бинарные файлы в расчёт не входят.
 */
const W_LETTER = 0.205; // латиница, включая расширенную
const W_CYRILLIC = 0.45;
const W_DIGIT = 0.8;
const W_SPACE = 0.07; // пробел и табуляция: обычно сливаются со словом
const W_NEWLINE = 0.5;
const W_PUNCT = 0.58; // знаки и прочие символы
/** Доплата за каждый символ хеш-подобной строки (поверх весов выше). */
const W_HASH_EXTRA = 0.28;
const HASH_LIKE = /[A-Za-z0-9+/=_-]{24,}/g;
const W_OTHER_LETTER = 0.8; // греческий, CJK и т. п.: грубо, без калибровки
const W_ASTRAL = 1.5; // эмодзи и прочее вне BMP

export function estimateTokens(text: string): number {
  if (!text) return 0;
  let total = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code < 128) {
      if ((code >= 97 && code <= 122) || (code >= 65 && code <= 90)) {
        total += W_LETTER;
      } else if (code >= 48 && code <= 57) {
        total += W_DIGIT;
      } else if (code === 32 || code === 9 || code === 13) {
        total += W_SPACE;
      } else if (code === 10) {
        total += W_NEWLINE;
      } else {
        total += W_PUNCT;
      }
    } else if (code >= 0x0400 && code <= 0x04ff) {
      total += W_CYRILLIC;
    } else if (code >= 0x00c0 && code <= 0x024f) {
      total += W_LETTER;
    } else if (code >= 0xd800 && code <= 0xdbff) {
      // Суррогатная пара — один символ вне BMP.
      total += W_ASTRAL;
      i++;
    } else {
      total += /\p{L}/u.test(text[i]) ? W_OTHER_LETTER : W_PUNCT;
    }
  }
  for (const [run] of text.matchAll(HASH_LIKE)) {
    // Только настоящие хеши: и буквы, и цифры (иначе это длинное слово).
    if (/\d/.test(run) && /[A-Za-z]/.test(run)) {
      total += run.length * W_HASH_EXTRA;
    }
  }
  return Math.max(1, Math.round(total));
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
 * Изображения и бинарные файлы исключены из расчёта (0): их текст в промпт не идёт.
 */
export function estimateAttachmentTokens(file: AttachedFile): number {
  if (file.type === "image" || file.type === "binary") return 0;
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
    logWarn(`Could not read tree file ${node.path}`, error);
    return 0;
  }
}
