import { domToPng } from "modern-screenshot";

import type { ExportFile } from "../../types";

import { sanitizeFileName } from "../index";
import { downloadBlob } from "./common";
import { buildPreviewHtml } from "../preview";

import {
  createExportContainer,
  removeContainer,
  waitForImages,
} from "./common";

export async function exportToPNG(
  editorHtml: string,
  files: ExportFile[],
  fileName: string,
): Promise<void> {
  const { html } = buildPreviewHtml(editorHtml, files);
  const container = createExportContainer(html);

  try {
    await waitForImages(container);
    await new Promise((resolve) => setTimeout(resolve, 150));

    const dataUrl = await domToPng(container, {
      scale: 2,
      backgroundColor: "#ffffff",
      width: 800,
    });

    const response = await fetch(dataUrl);
    const blob = await response.blob();
    downloadBlob(blob, `${sanitizeFileName(fileName)}.png`);
  } catch (error) {
    console.error("PNG Export Error:", error);
    throw new Error(
      `Ошибка экспорта PNG: ${error instanceof Error ? error.message : "Неизвестная ошибка"}`,
    );
  } finally {
    removeContainer(container);
  }
}
