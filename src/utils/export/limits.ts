import type { AttachedFile, ExportFormat } from "../../types";

const LIMITS = {
  pdf: { maxFiles: 20, maxChars: 300000 },
  docx: { maxFiles: 20, maxChars: 300000 },
  png: { maxFiles: 10, maxChars: 150000 },
};

export function validateExportLimits(
  format: ExportFormat,
  files: AttachedFile[],
): void {
  if (format === "md") return;

  const limits = LIMITS[format as keyof typeof LIMITS];
  if (!limits) return;

  if (files.length > limits.maxFiles) {
    throw new Error(
      `Слишком много файлов для экспорта в ${format.toUpperCase()}. ` +
        `Максимум: ${limits.maxFiles}. ` +
        `Совет: Для больших проектов используйте формат Markdown (.md).`,
    );
  }

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
