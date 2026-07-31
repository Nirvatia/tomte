/** export/index.ts */

import type { ExportFormat, AttachedFile } from '../../types';
import { exportToPDF } from './pdf';
import { exportToPNG } from './png';
import { exportToDOCX } from './docx';
import { exportToMD } from './md';
import { validateExportLimits } from './limits'; // <-- Новый импорт

export interface ExportOptions {
  openInNewTab?: boolean;
}

export async function exportFile(
  format: ExportFormat,
  editorHtml: string,
  files: AttachedFile[],
  fileName: string,
  options: ExportOptions = {}
): Promise<void> {
  try {
    // 1. МГНОВЕННАЯ ПРОВЕРКА ЛИМИТОВ (занимает < 1 мс)
    validateExportLimits(format, files);

    // 2. Если проверка пройдена, запускаем тяжёлый экспорт
    switch (format) {
      case 'md':
        await exportToMD(editorHtml, files, fileName);
        break;
      case 'pdf':
        await exportToPDF(editorHtml, files, fileName, options);
        break;
      case 'docx':
        await exportToDOCX(editorHtml, files, fileName);
        break;
      case 'png':
        await exportToPNG(editorHtml, files, fileName);
        break;
      default:
        throw new Error(`Неподдерживаемый формат экспорта: ${format}`);
    }
  } catch (error) {
    console.error('Global Export Error:', error);
    // Пробрасываем ошибку дальше, чтобы AppHeader её поймал и показал
    throw error;
  }
}

export { exportToMD } from './md';
export { exportToPDF } from './pdf';
export { exportToPNG } from './png';
export { exportToDOCX } from './docx';