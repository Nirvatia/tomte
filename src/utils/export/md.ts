/** export/md.ts */
// @ts-ignore

import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm'; // <-- Плагин для таблиц и зачёркиваний
import type { AttachedFile } from '../../types';
import { sanitizeFileName } from '../index';

// 1. Базовая настройка
const turndownService = new TurndownService({
  headingStyle: 'atx',       // # Заголовки
  codeBlockStyle: 'fenced',  // ``` блоки кода
  bulletListMarker: '-',     // Маркированные списки через -
  emDelimiter: '*',          // Курсив через *
  strongDelimiter: '**',     // Жирный через **
});

// 2. Включаем поддержку GitHub Flavored Markdown (Таблицы, Зачёркивания, Списки задач)
turndownService.use(gfm);

// 3. Кастомные правила для элементов, которые Tiptap добавляет, а стандартный MD не знает

// Зачёркивание (на всякий случай, если GFM не поймает специфичный тег Tiptap)
turndownService.addRule('strikethrough', {
  filter: ['del', 's', 'strike'],
  replacement: (content) => `~~${content}~~`,
});

// Выделение текста (Highlight / Mark)
// Превращаем <mark>текст</mark> в ==текст== (стандарт Obsidian/многих MD-редакторов)
// Если нужен чистый HTML внутри MD, можно вернуть `<mark>${content}</mark>`
turndownService.addRule('mark', {
  filter: 'mark',
  replacement: (content) => `==${content}==`,
});

// Сохранение переносов строк внутри абзацев (Tiptap часто использует <br>)
turndownService.addRule('lineBreak', {
  filter: 'br',
  replacement: () => '  \n', // Два пробела + перенос строки = hard break в MD
});

// ... (импорты и настройки turndown без изменений)

export async function exportToMD(
  editorHtml: string,
  files: AttachedFile[],
  fileName: string
): Promise<void> {
  let markdown = turndownService.turndown(editorHtml);

  // files уже отфильтрованы AppHeader'ом, просто проверяем наличие контента
  const filesToExport = files.filter(f => f.content);

  if (filesToExport.length > 0) {
    markdown += '\n\n---\n\n## 📎 Прикреплённые файлы\n\n';

    for (const file of filesToExport) {
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      const supportedLangs = ['js', 'ts', 'python', 'html', 'css', 'json', 'md', 'svelte', 'yaml', 'yml', 'rust', 'go', 'java', 'cpp', 'c', 'h', 'php', 'rb', 'sh', 'xml', 'sql', 'bash', 'zsh'];
      const lang = supportedLangs.includes(ext) ? ext : '';

      markdown += `### 📄 \`${file.name}\`\n\n`;
      markdown += `\`\`\`${lang}\n${file.content}\n\`\`\`\n\n`;
    }
  }

  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${sanitizeFileName(fileName)}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}