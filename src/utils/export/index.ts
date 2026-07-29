import type { ExportFormat, AttachedFile } from '../../types';
import { exportToPDF } from './pdf';
import { exportToPNG } from './png';
import { exportToDOCX } from './docx';

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
    switch (format) {
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
    throw error;
  }
}

export { exportToPDF } from './pdf';
export { exportToPNG } from './png';
export { exportToDOCX } from './docx';