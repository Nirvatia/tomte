import type { AttachedFile, ExportFormat } from "../../types";

import { exportToDOCX } from "./docx";
import { exportToMD } from "./md";
import { exportToPDF } from "./pdf";
import { exportToPNG } from "./png";
import { validateExportLimits } from "./limits";

export interface ExportOptions {
  openInNewTab?: boolean;
}

export async function exportFile(
  format: ExportFormat,
  editorHtml: string,
  files: AttachedFile[],
  fileName: string,
  options: ExportOptions = {},
): Promise<void> {
  try {
    validateExportLimits(format, files);

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
    throw error;
  }
}

export { exportToDOCX } from "./docx";
export { exportToMD } from "./md";
export { exportToPDF } from "./pdf";
export { exportToPNG } from "./png";
