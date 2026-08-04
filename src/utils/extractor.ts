import type { AttachedFile } from "../types";
import { generateId } from "./index";
import { zipSync, strToU8 } from "fflate";

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
  javascript: "js", js: "js", typescript: "ts", ts: "ts",
  python: "py", py: "py", html: "html", css: "css",
  java: "java", cpp: "cpp", c: "c", "c#": "cs", csharp: "cs",
  php: "php", ruby: "rb", go: "go", rust: "rs",
  json: "json", xml: "xml", yaml: "yaml", yml: "yml",
  sql: "sql", bash: "sh", sh: "sh", markdown: "md", md: "md",
  txt: "txt", svelte: "svelte", gdscript: "gd"
};

function findFileName(text: string): string | null {
  for (const pattern of FILE_PATTERNS) {
    const match = text.match(pattern);
    if (match) return match[1].replace(/\\/g, "/").trim();
  }
  return null;
}

function normalizeMarkdown(text: string): string {
  // Заменяем только "умные" кавычки на обычные. 
  // Обратные кавычки не трогаем, они и так правильные.
  return text
    .replace(/['']/g, "'")
    .replace(/[""]/g, '"');
}

export function extractFilesFromMarkdown(markdown: string): ExtractedFile[] {
  console.log("🔍 Начинаем поиск блоков кода в тексте длиной:", markdown.length);
  
  const normalizedMarkdown = normalizeMarkdown(markdown);
  const extracted: ExtractedFile[] = [];
  const usedNames = new Set<string>();
  
  // ✅ ИСПРАВЛЕННЫЙ REGEX:
  // 1. (?:^|\n) — блок должен начинаться с начала строки или после переноса
  // 2. \s*``` — допускаем пробелы перед кавычками
  // 3. ([a-zA-Z0-9_+\-#]+) — ✅ ТРЕБУЕМ хотя бы 1 символ языка (убирает ложные срабатывания на пустых ```)
  // 4. \s*\r?\n — перенос строки после языка (работает и с \r\n, и с \n)
  // 5. ([\s\S]*?) — содержимое (нежадный захват)
  // 6. \r?\n\s*``` — закрывающие кавычки должны быть на новой строке
  const blockRegex = /(?:^|\n)\s*```([a-zA-Z0-9_+\-#]+)\s*\r?\n([\s\S]*?)\r?\n\s*```/g;
  
  let match;
  let fileCounter = 1;
  let matchCount = 0;

  while ((match = blockRegex.exec(normalizedMarkdown)) !== null) {
    matchCount++;
    const lang = match[1].trim().toLowerCase();
    let code = match[2].trim();
    
    // Дополнительная защита: пропускаем блоки, которые слишком короткие и выглядят как обычный текст
    if (code.length < 15 && !code.includes('\n') && !lang) {
      console.log(`⚠️ Пропускаем блок #${matchCount}: слишком короткий, похож на текст`);
      continue;
    }
    
    console.log(`📦 Найден блок #${matchCount}:`);
    console.log(`   - Язык: "${lang}"`);
    console.log(`   - Начало кода: "${code.substring(0, 50).replace(/\n/g, '\\n')}"`);
    
    let fileName: string | null = null;

    // 1. Ищем имя файла до блока (500 символов)
    fileName = findFileName(normalizedMarkdown.substring(Math.max(0, match.index - 500), match.index));
    
    // 2. Если не нашли: после блока (300 символов)
    if (!fileName) {
      fileName = findFileName(normalizedMarkdown.substring(match.index + match[0].length, match.index + match[0].length + 300));
    }
    
    // 3. Если не нашли: в первых 5 строках самого кода
    if (!fileName) {
      fileName = findFileName(code.split("\n").slice(0, 5).join("\n"));
    }

    // 4. Фоллбэк: генерируем имя из языка
    if (!fileName) {
      const ext = LANG_EXT_MAP[lang] || "txt";
      fileName = `file_${fileCounter}.${ext}`;
    }

    // 5. Проверяем на дубликаты и добавляем суффикс
    let uniqueName = fileName;
    let counter = 1;
    while (usedNames.has(uniqueName)) {
      const lastDot = fileName.lastIndexOf('.');
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

    console.log(`✅ Итоговое имя файла: ${uniqueName} (lang: ${lang})`);
    
    extracted.push({ 
      id: generateId(), 
      name: uniqueName, 
      lang: lang, 
      code 
    });
    fileCounter++;
  }

  console.log(`🎯 Всего распознано файлов: ${extracted.length}`);
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