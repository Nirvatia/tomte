import { translate } from "$lib/i18n";
import type { AttachedFile, ExportFormat } from "../../types";

/** Экспорт упёрся в лимит: ожидаемая ситуация, а не сбой. */
export class ExportLimitError extends Error {
  name = "ExportLimitError";
}

const LIMITS = {
  pdf: { maxFiles: 20, maxChars: 300000 },
  docx: { maxFiles: 20, maxChars: 300000 },
  "docx-gost": { maxFiles: 20, maxChars: 300000 },
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
    throw new ExportLimitError(
      translate("export.limits.tooManyFiles", {
        format: format.toUpperCase(),
        max: limits.maxFiles,
      }),
    );
  }

  const totalChars = files.reduce(
    (sum, file) => sum + (file.content?.length || 0),
    0,
  );

  if (totalChars > limits.maxChars) {
    const sizeInKb = (totalChars / 1024).toFixed(1);
    throw new ExportLimitError(
      translate("export.limits.tooMuchText", {
        format: format.toUpperCase(),
        size: sizeInKb,
        max: (limits.maxChars / 1024).toFixed(0),
      }),
    );
  }
}
