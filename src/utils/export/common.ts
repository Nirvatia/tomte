import type { ExportFile } from "../../types";
import { resolveExportLabel } from "../files";

export function createExportContainer(html: string): HTMLDivElement {
  const container = document.createElement("div");
  container.style.cssText = `
    position: absolute;
    left: -10000px;
    top: 0;
    width: 794px;
    background: #ffffff;
    z-index: -9999;
  `;
  // export-preview переопределяет CSS-переменные темы на светлую палитру:
  // тёмный текст на белом фоне, читаемые таблицы и блоки кода.
  container.innerHTML = `
    <div class="export-preview" style="padding: 40px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #0f172a; line-height: 1.6; font-size: 14px;">
      <div class="preview-content max-w-none">${html}</div>
    </div>
  `;
  document.body.appendChild(container);
  return container;
}

export function removeContainer(container: HTMLDivElement): void {
  if (document.body.contains(container)) {
    document.body.removeChild(container);
  }
}

export async function waitForImages(container: HTMLElement): Promise<void> {
  const images = Array.from(container.querySelectorAll("img"));
  const promises = images.map((img) => {
    if (img.complete) return Promise.resolve();
    return new Promise<void>((resolve) => {
      img.onload = () => resolve();
      img.onerror = () => resolve();
    });
  });
  await Promise.all(promises);
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Подпись файла в экспорте: «FILE_2: notes.md», а для файлов без метки — просто имя. */
export function exportTitle(file: ExportFile, files: ExportFile[]): string {
  const label = resolveExportLabel(file, files);
  return label ? `${label}: ${file.name}` : file.name;
}
