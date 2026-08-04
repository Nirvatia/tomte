import type { ExportFormat, AttachedFile } from "../../types";
import { exportToPDF } from "./pdf";
import { exportToPNG } from "./png";
import { exportToDOCX } from "./docx";
import { exportToMD } from "./md";
import { validateExportLimits } from "./limits";

export interface ExportOptions {
  openInNewTab?: boolean;
}

/**
 * Главная функция экспорта. Проверяет лимиты и делегирует работу нужному модулю.
 */
export async function exportFile(
  format: ExportFormat,
  editorHtml: string,
  files: AttachedFile[],
  fileName: string,
  options: ExportOptions = {},
): Promise<void> {
  try {
    // 1. Мгновенная проверка лимитов (занимает < 1 мс)
    validateExportLimits(format, files);

    // 2. Выполнение экспорта в зависимости от формата
    switch (format) {
      case "md":
        await exportToMD(editorHtml, files, fileName);
        break;
      case "pdf":
        await exportToPDF(editorHtml, files, fileName, options);
        break;
      case "docx":
        await exportToDOCX(editorHtml, files, fileName);
        break;
      case "png":
        await exportToPNG(editorHtml, files, fileName);
        break;
      default:
        throw new Error(`Неподдерживаемый формат экспорта: ${format}`);
    }
  } catch (error) {
    console.error("Global Export Error:", error);
    // Пробрасываем ошибку дальше, чтобы UI (AppHeader) мог её перехватить и показать
    throw error;
  }
}

export { exportToMD } from "./md";
export { exportToPDF } from "./pdf";
export { exportToPNG } from "./png";
export { exportToDOCX } from "./docx";
