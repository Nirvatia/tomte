import type { AttachedFile } from '../types';

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
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function buildPreviewHtml(editorHtml: string, files: AttachedFile[]): PreviewResult {
  let result = editorHtml;
  const stats = {
    totalFiles: files.length,
    usedImages: 0,
    unusedImages: 0,
    usedFiles: 0,
    unusedFiles: 0,
    attachedTexts: 0,
  };

  // 1. Заменяем плейсхолдеры изображений на реальные <img>
  let imgIndex = 1;
  files.forEach((f) => {
    if (f.type === 'image' && f.dataUrl) {
      const regex = new RegExp(`\\[IMAGE_${imgIndex}(:[^\\]]+)?\\]`, 'g');
      const matches = result.match(regex);
      
      if (matches && matches.length > 0) {
        stats.usedImages++;
        const imageHtml = `
          <div class="preview-image-block">
            <div class="preview-image-label">[IMAGE_${imgIndex}: ${escapeHtml(f.name)}]</div>
            <img src="${f.dataUrl}" alt="${escapeHtml(f.name)}" />
          </div>
        `;
        result = result.replace(regex, imageHtml);
      } else {
        stats.unusedImages++;
      }
      imgIndex++;
    }
  });

  // 2. Подсвечиваем плейсхолдеры файлов
  let fileIndex = 1;
  files.forEach((f) => {
    if (f.type === 'text') {
      const regex = new RegExp(`\\[FILE_${fileIndex}(:[^\\]]+)?\\]`, 'g');
      const matches = result.match(regex);
      
      if (matches && matches.length > 0) {
        stats.usedFiles++;
        result = result.replace(
          regex,
          `<span class="preview-file-placeholder">[FILE_${fileIndex}: ${escapeHtml(f.name)}]</span>`
        );
      } else {
        stats.unusedFiles++;
      }
      fileIndex++;
    }
  });

  // 3. ВАРИАНТ B: Добавляем в конец ТОЛЬКО если плейсхолдера НЕТ в тексте
  let appendixHtml = '';
  
  // Текстовые файлы с includeInExport=true, но без плейсхолдера в тексте
  let textFileIndex = 1;
  files.forEach((f) => {
    if (f.type === 'text' && f.content) {
      const placeholderPattern = `[FILE_${textFileIndex}`;
      const hasPlaceholder = editorHtml.includes(placeholderPattern);
      
      // Добавляем в конец, если включён экспорт И нет плейсхолдера в тексте
      if (f.includeInExport && !hasPlaceholder) {
        const separator = '═'.repeat(40);
        appendixHtml += `
          <div class="preview-attached-file">
            <div class="preview-attached-label">FILE_${textFileIndex}: ${escapeHtml(f.name)}</div>
            <pre class="preview-attached-content">${escapeHtml(f.content)}</pre>
          </div>
        `;
        stats.attachedTexts++;
      }
      textFileIndex++;
    }
  });

  // Неиспользованные изображения (без плейсхолдера в тексте)
  let checkImgIndex = 1;
  files.forEach((f) => {
    if (f.type === 'image' && f.dataUrl) {
      const placeholderPattern = `[IMAGE_${checkImgIndex}`;
      if (!editorHtml.includes(placeholderPattern)) {
        appendixHtml += `
          <div class="preview-unused-image">
            <div class="preview-unused-label">Вложение IMAGE_${checkImgIndex}: ${escapeHtml(f.name)} (без плейсхолдера)</div>
            <img src="${f.dataUrl}" alt="${escapeHtml(f.name)}" />
          </div>
        `;
      }
      checkImgIndex++;
    }
  });

  return {
    html: result + (appendixHtml ? `<div class="preview-appendix">${appendixHtml}</div>` : ''),
    stats,
  };
}