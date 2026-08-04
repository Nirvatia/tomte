import type { AttachedFile, ExportFormat } from "../../types";

// Конфигурация лимитов для "тяжёлых" форматов рендеринга
const LIMITS = {
  pdf: { maxFiles: 20, maxChars: 300000 }, // ~300 КБ чистого текста
  docx: { maxFiles: 20, maxChars: 300000 },
  png: { maxFiles: 10, maxChars: 150000 }, // PNG ещё тяжелее для Canvas
};

/**
 * Проверяет, не превышает ли массив файлов допустимые лимиты для выбранного формата.
 * Формат 'md' не имеет ограничений, так как это простая текстовая конкатенация.
 */
export function validateExportLimits(
  format: ExportFormat,
  files: AttachedFile[],
): void {
  if (format === "md") return;

  const limits = LIMITS[format as keyof typeof LIMITS];
  if (!limits) return;

  // 1. Проверка количества файлов
  if (files.length > limits.maxFiles) {
    throw new Error(
      `Слишком много файлов для экспорта в ${format.toUpperCase()}. ` +
        `Максимум: ${limits.maxFiles}. ` +
        `Совет: Для больших проектов используйте формат Markdown (.md).`,
    );
  }

  // 2. Проверка общего объёма текста
  const totalChars = files.reduce(
    (sum, file) => sum + (file.content?.length || 0),
    0,
  );

  if (totalChars > limits.maxChars) {
    const sizeInKb = (totalChars / 1024).toFixed(1);
    throw new Error(
      `Слишком большой объём текста для ${format.toUpperCase()} (${sizeInKb} КБ). ` +
        `Максимум: ~${(limits.maxChars / 1024).toFixed(0)} КБ. ` +
        `Совет: Снимите выделение с крупных файлов или используйте экспорт в Markdown (.md).`,
    );
  }
}
