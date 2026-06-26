import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Document, Packer, Paragraph, TextRun, ImageRun, HeadingLevel, Table, TableRow, TableCell, WidthType, BorderStyle, AlignmentType } from 'docx';
import type { AttachedFile, ExportFormat } from '../types';
import { buildPreviewHtml } from './preview';
import { sanitizeFileName } from './index';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function createExportContainer(html: string): HTMLDivElement {
  const container = document.createElement('div');
  container.style.cssText = `
    position: fixed;
    top: -9999px;
    left: -9999px;
    width: 800px;
    padding: 40px;
    background: white;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    color: #1a1a1a;
    line-height: 1.6;
    font-size: 14px;
  `;
  container.innerHTML = html;
  document.body.appendChild(container);
  return container;
}

function removeContainer(container: HTMLDivElement): void {
  document.body.removeChild(container);
}

export async function exportToPDF(
  editorHtml: string,
  files: AttachedFile[],
  fileName: string
): Promise<void> {
  const { html } = buildPreviewHtml(editorHtml, files);
  const container = createExportContainer(html);

  try {
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false,
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 10;
    const contentWidth = pageWidth - margin * 2;
    const imgWidth = contentWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = margin;

    pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
    heightLeft -= pageHeight - margin * 2;

    while (heightLeft > 0) {
      position = heightLeft - imgHeight + margin;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
      heightLeft -= pageHeight - margin * 2;
    }

    pdf.save(`${sanitizeFileName(fileName)}.pdf`);
  } finally {
    removeContainer(container);
  }
}

export async function exportToPNG(
  editorHtml: string,
  files: AttachedFile[],
  fileName: string
): Promise<void> {
  const { html } = buildPreviewHtml(editorHtml, files);
  const container = createExportContainer(html);

  try {
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
    });

    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${sanitizeFileName(fileName)}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 'image/png');
  } finally {
    removeContainer(container);
  }
}

function createDocxParagraphs(text: string): Paragraph[] {
  const lines = text.split('\n');
  return lines.map(
    (line) =>
      new Paragraph({
        children: [new TextRun({ text: line, size: 24 })],
        spacing: { after: 100 },
      })
  );
}

function createDocxImage(dataUrl: string, width: number, height: number): ImageRun {
  const base64 = dataUrl.split(',')[1];
  const buffer = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

  const maxWidth = 500;
  const scale = Math.min(1, maxWidth / width);
  const finalWidth = Math.round(width * scale);
  const finalHeight = Math.round(height * scale);

  return new ImageRun({
    data: buffer,
    transformation: {
      width: finalWidth,
      height: finalHeight,
    },
    type: 'png',
  });
}

export async function exportToDOCX(
  editorHtml: string,
  files: AttachedFile[],
  fileName: string
): Promise<void> {
  const { html } = buildPreviewHtml(editorHtml, files);
  const container = createExportContainer(html);

  try {
    const sections: Paragraph[] = [];

    // Заголовок
    sections.push(
      new Paragraph({
        children: [
          new TextRun({
            text: 'Prompt Document',
            bold: true,
            size: 48,
            color: '2563EB',
          }),
        ],
        heading: HeadingLevel.TITLE,
        spacing: { after: 200 },
      })
    );

    // Мета
    sections.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `Создано: ${new Date().toLocaleString('ru-RU')} · Файлов: ${files.length}`,
            italics: true,
            size: 20,
            color: '666666',
          }),
        ],
        spacing: { after: 400 },
      })
    );

    // Разделитель
    sections.push(
      new Paragraph({
        children: [new TextRun({ text: '─'.repeat(60), color: '2563EB' })],
        spacing: { after: 400 },
      })
    );

    // Текст промпта
    sections.push(
      new Paragraph({
        children: [
          new TextRun({
            text: 'Текст промпта',
            bold: true,
            size: 28,
            color: '2563EB',
          }),
        ],
        spacing: { after: 200 },
      })
    );

    const plainText = container.innerText;
    sections.push(...createDocxParagraphs(plainText));

    // Вложения
    if (files.length > 0) {
      sections.push(
        new Paragraph({
          children: [new TextRun({ text: '─'.repeat(60), color: '2563EB' })],
          spacing: { before: 400, after: 400 },
        })
      );

      sections.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `Вложения (${files.length})`,
              bold: true,
              size: 28,
              color: '2563EB',
            }),
          ],
          spacing: { after: 200 },
        })
      );

      // Изображения
      const images = files.filter((f) => f.type === 'image' && f.dataUrl);
      if (images.length > 0) {
        sections.push(
          new Paragraph({
            children: [
              new TextRun({
                text: 'Изображения',
                bold: true,
                size: 24,
                color: '2563EB',
              }),
            ],
            spacing: { before: 200, after: 200 },
          })
        );

        for (let i = 0; i < images.length; i++) {
          const img = images[i];
          sections.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: `IMAGE_${i + 1}: ${img.name}`,
                  bold: true,
                  size: 22,
                  color: '2563EB',
                }),
              ],
              spacing: { after: 100 },
            })
          );

          if (img.dataUrl && img.width && img.height) {
            sections.push(
              new Paragraph({
                children: [createDocxImage(img.dataUrl, img.width, img.height)],
                spacing: { after: 300 },
              })
            );
          }
        }
      }

      // Текстовые файлы
      const textFiles = files.filter((f) => f.type === 'text');
      if (textFiles.length > 0) {
        sections.push(
          new Paragraph({
            children: [
              new TextRun({
                text: 'Текстовые файлы',
                bold: true,
                size: 24,
                color: '059669',
              }),
            ],
            spacing: { before: 200, after: 200 },
          })
        );

        for (let i = 0; i < textFiles.length; i++) {
          const file = textFiles[i];
          sections.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: `FILE_${i + 1}: ${file.name}`,
                  bold: true,
                  size: 22,
                  color: '059669',
                }),
              ],
              spacing: { after: 100 },
            })
          );

          if (file.includeInExport && file.content) {
            sections.push(...createDocxParagraphs(file.content));
          }
        }
      }
    }

    const doc = new Document({
      sections: [
        {
          children: sections,
        },
      ],
    });

    const blob = await Packer.toBlob(doc);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${sanitizeFileName(fileName)}.docx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } finally {
    removeContainer(container);
  }
}

export async function exportFile(
  format: ExportFormat,
  editorHtml: string,
  files: AttachedFile[],
  fileName: string
): Promise<void> {
  switch (format) {
    case 'pdf':
      await exportToPDF(editorHtml, files, fileName);
      break;
    case 'docx':
      await exportToDOCX(editorHtml, files, fileName);
      break;
    case 'png':
      await exportToPNG(editorHtml, files, fileName);
      break;
    default:
      console.error(`Unsupported export format: ${format}`);
  }
}