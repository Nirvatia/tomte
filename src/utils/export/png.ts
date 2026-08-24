import { domToPng } from "modern-screenshot";

import type { AttachedFile } from "../../types";

import { sanitizeFileName } from "../index";
import { buildPreviewHtml } from "../preview";

import {
  createExportContainer,
  removeContainer,
  waitForImages,
} from "./common";

export async function exportToPNG(
  editorHtml: string,
  files: AttachedFile[],
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
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${sanitizeFileName(fileName)}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error("PNG Export Error:", error);
    throw new Error(
      `Ошибка экспорта PNG: ${error instanceof Error ? error.message : "Неизвестная ошибка"}`,
    );
  } finally {
    removeContainer(container);
  }
}
