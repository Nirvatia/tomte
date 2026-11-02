// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { en } from "../../../src/lib/i18n/locales/en";
import { es } from "../../../src/lib/i18n/locales/es";

const SRC = join(__dirname, "../../../src");
const CYRILLIC = /[А-Яа-яЁё]/;

/** Файлы, где русский текст — это данные, а не интерфейс. */
const ALLOWED = [
  "lib/i18n/locales/ru.ts",
  "utils/testData.ts", // тестовый документ для проверки экспорта
  "lib/i18n/index.ts", // самоназвания языков в переключателе («Русский»)
];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

/** Убирает комментарии: русские комментарии в коде — нормально. */
function stripComments(code: string): string {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
}

function strings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (value && typeof value === "object")
    return Object.values(value).flatMap(strings);
  return [];
}

describe("переводы", () => {
  it("в коде нет русского текста вне словаря (кроме комментариев)", () => {
    const offenders = walk(SRC)
      .filter((f) => /\.(ts|svelte)$/.test(f))
      .filter((f) => !ALLOWED.some((allowed) => f.endsWith(allowed)))
      .flatMap((file) =>
        stripComments(readFileSync(file, "utf8"))
          .split("\n")
          .map((line, i) => ({
            file: file.replace(SRC + "/", ""),
            line: i + 1,
            text: line.trim(),
          }))
          .filter(({ text }) => CYRILLIC.test(text)),
      );
    expect(offenders).toEqual([]);
  });

  it("в английском и испанском словарях нет непереведённых строк", () => {
    // ГОСТ-заголовок в en/es не используется (ГОСТ всегда по-русски), но тоже переведён.
    expect(strings(en).filter((s) => CYRILLIC.test(s))).toEqual([]);
    expect(strings(es).filter((s) => CYRILLIC.test(s))).toEqual([]);
  });
});
