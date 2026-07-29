import type { AttachedFile } from '../../types';

export function createExportContainer(html: string): HTMLDivElement {
  const container = document.createElement('div');
  // 794px = ровно 210mm (ширина A4) при 96 DPI
  container.style.cssText = `
    position: absolute;
    left: -10000px;
    top: 0;
    width: 794px;
    background: #ffffff;
    z-index: -9999;
  `;
  
  // 40px padding ≈ 15mm (стандартные поля документа)
  container.innerHTML = `
    <div style="padding: 40px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1a1a1a; line-height: 1.6; font-size: 14px;">
      <div class="preview-content prose max-w-none">${html}</div>
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
  const images = Array.from(container.querySelectorAll('img'));
  const promises = images.map(img => {
    if (img.complete) return Promise.resolve();
    return new Promise<void>(resolve => {
      img.onload = () => resolve();
      img.onerror = () => resolve();
    });
  });
  await Promise.all(promises);
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function buildAttachmentsHtml(files: AttachedFile[]): string {
  if (files.length === 0) return '';

  let html = `
    <hr style="border: 2px solid #2563EB; margin: 2rem 0;" />
    <h2 style="color: #2563EB; font-size: 1.5rem; font-weight: bold;">Вложения (${files.length})</h2>
  `;

  const images = files.filter(f => f.type === 'image' && f.dataUrl);
  if (images.length > 0) {
    html += `<h3 style="color: #2563EB; font-size: 1.25rem; font-weight: bold; margin-top: 1.5rem;">Изображения</h3>`;
    images.forEach((img, i) => {
      html += `
        <div style="margin: 1rem 0;">
          <p style="font-weight: bold; color: #2563EB;">IMAGE_${i + 1}: ${escapeHtml(img.name)}</p>
          <img src="${img.dataUrl}" alt="${escapeHtml(img.name)}" style="max-width: 100%; height: auto;" />
        </div>
      `;
    });
  }

  const textFiles = files.filter(f => f.type === 'text');
  if (textFiles.length > 0) {
    html += `<h3 style="color: #059669; font-size: 1.25rem; font-weight: bold; margin-top: 1.5rem;">Текстовые файлы</h3>`;
    textFiles.forEach((file, i) => {
      html += `
        <div style="margin: 1rem 0;">
          <p style="font-weight: bold; color: #059669;">FILE_${i + 1}: ${escapeHtml(file.name)}</p>
          ${file.includeInExport && file.content 
            ? `<pre style="background: #f1f5f9; padding: 1rem; border-radius: 0.5rem; font-family: monospace; font-size: 0.875rem; white-space: pre-wrap; overflow-x: auto;">${escapeHtml(file.content)}</pre>`
            : ''
          }
        </div>
      `;
    });
  }

  return html;
}