/** export/pdf.ts */

import jsPDF from 'jspdf';
import { domToPng } from 'modern-screenshot';
import type { AttachedFile } from '../../types';
import { buildPreviewHtml } from '../preview';
import { sanitizeFileName } from '../index';
import { createExportContainer, removeContainer, waitForImages } from './common';
import type { ExportOptions } from './index';

export async function exportToPDF(
  editorHtml: string,
  files: AttachedFile[],
  fileName: string,
  options: ExportOptions = {}
): Promise<void> {
  const { html } = buildPreviewHtml(editorHtml, files);
  const container = createExportContainer(html);

  try {
    await waitForImages(container);
    await new Promise((resolve) => setTimeout(resolve, 200));

    const fullDataUrl = await domToPng(container, {
      scale: 2,
      backgroundColor: '#ffffff',
      width: 794,
    });

    const fullImage = new Image();
    fullImage.src = fullDataUrl;
    await new Promise((resolve) => {
      fullImage.onload = resolve;
    });

    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidthMM = 210;
    const pageHeightMM = 297;
    const marginMM = 15;
    const contentWidthMM = pageWidthMM - marginMM * 2;

    const pxPerMM = fullImage.width / contentWidthMM;
    const pageContentHeightPX = (pageHeightMM - marginMM * 2) * pxPerMM;
    const totalPages = Math.ceil(fullImage.height / pageContentHeightPX);

    for (let page = 0; page < totalPages; page++) {
      if (page > 0) pdf.addPage();

      const pageCanvas = document.createElement('canvas');
      pageCanvas.width = contentWidthMM * pxPerMM;
      pageCanvas.height = pageContentHeightPX;

      const ctx = pageCanvas.getContext('2d');
      if (!ctx) continue;

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);

      const sourceY = page * pageContentHeightPX;
      ctx.drawImage(
        fullImage,
        0,
        sourceY,
        fullImage.width,
        pageContentHeightPX,
        0,
        0,
        pageCanvas.width,
        pageCanvas.height
      );

      const pageDataUrl = pageCanvas.toDataURL('image/png');
      pdf.addImage(
        pageDataUrl,
        'PNG',
        marginMM,
        marginMM,
        contentWidthMM,
        pageHeightMM - marginMM * 2
      );
    }

    const safeName = `${sanitizeFileName(fileName)}.pdf`;

    if (options.openInNewTab) {
      // 1. Сценарий "Открыть в новой вкладке"
      const pdfBlob = pdf.output('blob');
      const blobUrl = URL.createObjectURL(pdfBlob);
      const newTab = window.open(blobUrl, '_blank');
      
      // Если браузер заблокировал открытие вкладки из-за асинхронности
      if (!newTab) {
        window.location.href = blobUrl;
      }
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
    } else {
      // 2. Сценарий "Принудительное скачивание" (Без открытия новой вкладки)
      const rawBlob = pdf.output('blob');
      // Использование 'application/octet-stream' гарантирует, что Firefox и Chrome 
      // начнут загрузку, а не попытаются открыть встроенный просмотрщик PDF
      const forceDownloadBlob = new Blob([rawBlob], { type: 'application/octet-stream' });
      const blobUrl = URL.createObjectURL(forceDownloadBlob);

      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = safeName;
      link.style.display = 'none';

      document.body.appendChild(link);
      link.click();

      // Очищаем DOM и память с небольшой задержкой
      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);
      }, 500);
    }
  } catch (error) {
    console.error('PDF Export Error:', error);
    throw new Error(`Ошибка экспорта PDF: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
  } finally {
    removeContainer(container);
  }
}