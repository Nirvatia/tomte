import type { ExportFile } from "../types";
import { resolveExportLabel } from "./files";
import { translate } from "$lib/i18n";

export interface PreviewResult {
  html: string;
  stats: {
    totalFiles: number;
    usedImages: number;
    unusedImages: number;
    usedFiles: number;
    unusedFiles: number;
    attachedTexts: number;
  };
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/=/g, "&#61;");
}

/** Плейсхолдер [LABEL] или [LABEL: что угодно]. Точное совпадение: FILE_1 не ловит FILE_10. */
function placeholderRegex(label: string): RegExp {
  return new RegExp(`\\[${label}(?::[^\\]]*)?\\]`, "g");
}

function imageBlock(
  title: string,
  file: ExportFile,
  className: string,
): string {
  return `
    <div class="${className}">
      <div class="${className === "preview-image-block" ? "preview-image-label" : "preview-unused-label"}">${title}</div>
      <img src="${escapeHtml(file.dataUrl ?? "")}" alt="${escapeHtml(file.name)}" />
    </div>
  `;
}

/**
 * Собирает HTML для превью и для экспорта в PDF/PNG:
 * подставляет картинки на место [IMAGE_n], подсвечивает [FILE_n],
 * картинки без плейсхолдера и содержимое всех текстовых файлов добавляет в конец.
 *
 * Номера берутся из file.label (см. ExportFile), поэтому совпадают
 * с тем, что пользователь видит в редакторе, даже если отобрана часть вложений.
 */
export function buildPreviewHtml(
  editorHtml: string,
  files: ExportFile[],
): PreviewResult {
  let result = editorHtml;
  let appendixHtml = "";
  const stats = {
    totalFiles: files.length,
    usedImages: 0,
    unusedImages: 0,
    usedFiles: 0,
    unusedFiles: 0,
    attachedTexts: 0,
  };

  for (const file of files) {
    const label = resolveExportLabel(file, files);
    const regex = label ? placeholderRegex(label) : null;
    const isReferenced = regex ? regex.test(editorHtml) : false;
    const title = label
      ? `${label}: ${escapeHtml(file.name)}`
      : escapeHtml(file.name);

    if (file.type === "image") {
      if (!file.dataUrl) continue;
      if (isReferenced && regex) {
        stats.usedImages++;
        result = result.replace(
          regex,
          imageBlock(`[${title}]`, file, "preview-image-block"),
        );
      } else {
        stats.unusedImages++;
        appendixHtml += imageBlock(
          translate("preview.unusedImage", { title }),
          file,
          "preview-unused-image",
        );
      }
      continue;
    }

    // Текстовые и бинарные файлы: ссылку в тексте подсвечиваем,
    // а содержимое текста всегда кладём в приложение — иначе ссылка
    // [FILE_n] в PDF/PNG вела бы в никуда.
    if (isReferenced && regex) {
      stats.usedFiles++;
      result = result.replace(
        regex,
        `<span class="preview-file-placeholder">[${title}]</span>`,
      );
    } else {
      stats.unusedFiles++;
    }

    if (file.type === "text" && file.content) {
      appendixHtml += `
        <div class="preview-attached-file">
          <div class="preview-attached-label">${title}</div>
          <pre class="preview-attached-content">${escapeHtml(file.content)}</pre>
        </div>
      `;
      stats.attachedTexts++;
    }
  }

  return {
    html:
      result +
      (appendixHtml
        ? `<div class="preview-appendix">${appendixHtml}</div>`
        : ""),
    stats,
  };
}
