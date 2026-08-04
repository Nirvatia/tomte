// @ts-ignore - типы для turndown-plugin-gfm отсутствуют в реестре, но плагин работает корректно
import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";
import type { AttachedFile } from "../../types";
import { sanitizeFileName } from "../index";

// 1. Базовая настройка конвертера
const turndownService = new TurndownService({
  headingStyle: "atx", // # Заголовки
  codeBlockStyle: "fenced", // ``` блоки кода
  bulletListMarker: "-", // Маркированные списки через -
  emDelimiter: "*", // Курсив через *
  strongDelimiter: "**", // Жирный через **
});

// 2. Включаем поддержку GitHub Flavored Markdown (Таблицы, Зачёркивания, Списки задач)
turndownService.use(gfm);

// 3. Кастомные правила для специфичных элементов Tiptap
turndownService.addRule("strikethrough", {
  filter: ["del", "s", "strike"],
  replacement: (content) => `~~${content}~~`,
});

turndownService.addRule("mark", {
  filter: "mark",
  replacement: (content) => `==${content}==`, // Стандарт Obsidian/многих MD-редакторов
});

turndownService.addRule("lineBreak", {
  filter: "br",
  replacement: () => "  \n", // Два пробела + перенос строки = hard break в MD
});

/**
 * Экспортирует содержимое редактора и файлы в формат Markdown
 */
export async function exportToMD(
  editorHtml: string,
  files: AttachedFile[],
  fileName: string,
): Promise<void> {
  // 1. Конвертируем HTML редактора в Markdown
  let markdown = turndownService.turndown(editorHtml);

  // 2. Добавляем файлы (массив уже отфильтрован на уровне AppHeader)
  const filesToExport = files.filter((f) => f.content);

  if (filesToExport.length > 0) {
    markdown += "\n\n---\n\n## 📎 Прикреплённые файлы\n\n";

    for (const file of filesToExport) {
      const ext = file.name.split(".").pop()?.toLowerCase() || "";
      const supportedLangs = [
        "js",
        "ts",
        "python",
        "html",
        "css",
        "json",
        "md",
        "svelte",
        "yaml",
        "yml",
        "rust",
        "go",
        "java",
        "cpp",
        "c",
        "h",
        "php",
        "rb",
        "sh",
        "xml",
        "sql",
        "bash",
        "zsh",
      ];
      const lang = supportedLangs.includes(ext) ? ext : "";

      markdown += `### 📄 \`${file.name}\`\n\n`;
      markdown += `\`\`\`${lang}\n${file.content}\n\`\`\`\n\n`;
    }
  }

  // 3. Создаём и скачиваем файл
  const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${sanitizeFileName(fileName)}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
