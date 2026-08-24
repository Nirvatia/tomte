import {
  BorderStyle,
  Document,
  HeadingLevel,
  ImageRun,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";

import type { AttachedFile } from "../../types";

import { sanitizeFileName } from "../index";
import { buildPreviewHtml } from "../preview";

function parseHtmlToDocx(html: string): (Paragraph | Table)[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const elements: (Paragraph | Table)[] = [];

  function processNode(node: Node): void {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent?.trim();
      if (text) {
        elements.push(
          new Paragraph({
            children: [new TextRun({ text, size: 24 })],
            spacing: { after: 100 },
          }),
        );
      }
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return;

    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();

    switch (tag) {
      case "h1":
        elements.push(
          new Paragraph({
            children: [
              new TextRun({ text: el.textContent || "", bold: true, size: 48 }),
            ],
            heading: HeadingLevel.HEADING_1,
            spacing: { after: 200 },
          }),
        );
        break;
      case "h2":
        elements.push(
          new Paragraph({
            children: [
              new TextRun({ text: el.textContent || "", bold: true, size: 36 }),
            ],
            heading: HeadingLevel.HEADING_2,
            spacing: { after: 150 },
          }),
        );
        break;
      case "h3":
        elements.push(
          new Paragraph({
            children: [
              new TextRun({ text: el.textContent || "", bold: true, size: 28 }),
            ],
            heading: HeadingLevel.HEADING_3,
            spacing: { after: 100 },
          }),
        );
        break;
      case "p":
        elements.push(createParagraphFromInline(el));
        break;
      case "ul":
      case "ol":
        processList(el, tag === "ol");
        break;
      case "blockquote":
        elements.push(
          new Paragraph({
            children: [
              new TextRun({
                text: el.textContent || "",
                italics: true,
                size: 24,
                color: "475569",
              }),
            ],
            indent: { left: 720 },
            border: {
              left: {
                style: BorderStyle.SINGLE,
                size: 12,
                color: "818cf8",
                space: 10,
              },
            },
            shading: { type: "clear", color: "auto", fill: "EEF2FF" },
            spacing: { after: 100, before: 100 },
          }),
        );
        break;
      case "table":
        processTable(el);
        break;
      case "pre":
        const codeText = el.textContent || "";
        codeText.split("\n").forEach((line) => {
          elements.push(
            new Paragraph({
              children: [
                new TextRun({ text: line, font: "Courier New", size: 20 }),
              ],
              spacing: { after: 50 },
            }),
          );
        });
        break;
      default:
        Array.from(el.childNodes).forEach(processNode);
    }
  }

  function createParagraphFromInline(el: HTMLElement): Paragraph {
    const runs: TextRun[] = [];

    function extractRuns(node: Node): void {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent;
        if (text) runs.push(new TextRun({ text, size: 24 }));
        return;
      }

      if (node.nodeType !== Node.ELEMENT_NODE) return;

      const child = node as HTMLElement;
      const tag = child.tagName.toLowerCase();
      const baseProps: any = { text: child.textContent || "", size: 24 };

      if (tag === "strong" || tag === "b") baseProps.bold = true;
      if (tag === "em" || tag === "i") baseProps.italics = true;
      if (tag === "u") baseProps.underline = {};
      if (tag === "s" || tag === "strike" || tag === "del")
        baseProps.strike = true;
      if (tag === "mark") baseProps.highlight = "yellow";
      if (tag === "code") {
        baseProps.font = "Courier New";
        baseProps.size = 20;
      }

      if (
        child.childNodes.length === 1 &&
        child.childNodes[0].nodeType === Node.TEXT_NODE
      ) {
        runs.push(new TextRun(baseProps));
      } else {
        Array.from(child.childNodes).forEach(extractRuns);
      }
    }

    Array.from(el.childNodes).forEach(extractRuns);
    if (runs.length === 0)
      runs.push(new TextRun({ text: el.textContent || "", size: 24 }));
    return new Paragraph({ children: runs, spacing: { after: 100 } });
  }

  function processList(
    listEl: HTMLElement,
    ordered: boolean,
    level: number = 0,
  ): void {
    const items = Array.from(listEl.children).filter(
      (c) => c.tagName.toLowerCase() === "li",
    );

    items.forEach((li, index) => {
      const textParts: string[] = [];
      Array.from(li.childNodes).forEach((node) => {
        if (node.nodeType === Node.TEXT_NODE) {
          const text = node.textContent?.trim();
          if (text) textParts.push(text);
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          const child = node as HTMLElement;
          if (
            child.tagName.toLowerCase() !== "ul" &&
            child.tagName.toLowerCase() !== "ol"
          ) {
            const text = child.textContent?.trim();
            if (text) textParts.push(text);
          }
        }
      });

      const text = textParts.join(" ");
      const indent = 360 + level * 360;
      const prefix = ordered ? `${index + 1}. ` : "• ";

      elements.push(
        new Paragraph({
          children: [new TextRun({ text: prefix + text, size: 24 })],
          indent: { left: indent },
          spacing: { after: 50 },
        }),
      );

      const nestedLists = Array.from(li.children).filter(
        (c) =>
          c.tagName.toLowerCase() === "ul" || c.tagName.toLowerCase() === "ol",
      );

      nestedLists.forEach((nestedList) => {
        processList(
          nestedList as HTMLElement,
          nestedList.tagName.toLowerCase() === "ol",
          level + 1,
        );
      });
    });
  }

  function processTable(tableEl: HTMLElement): void {
    const rows = Array.from(tableEl.querySelectorAll("tr"));
    if (rows.length === 0) return;

    const tableRows = rows.map((row) => {
      const cells = Array.from(row.querySelectorAll("th, td"));
      return new TableRow({
        children: cells.map((cell) => {
          const isHeader = cell.tagName.toLowerCase() === "th";
          return new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: cell.textContent || "",
                    size: 22,
                    bold: isHeader,
                  }),
                ],
              }),
            ],
            width: { size: 100 / cells.length, type: WidthType.PERCENTAGE },
            margins: { top: 80, bottom: 80, left: 120, right: 120 },
            shading: isHeader
              ? { type: "clear", color: "auto", fill: "F8FAFC" }
              : undefined,
          });
        }),
      });
    });

    elements.push(
      new Table({
        rows: tableRows,
        width: { size: 100, type: WidthType.PERCENTAGE },
      }),
    );
    elements.push(new Paragraph({ children: [], spacing: { after: 100 } }));
  }

  Array.from(doc.body.childNodes).forEach(processNode);
  return elements;
}

function createDocxImage(
  dataUrl: string,
  width: number,
  height: number,
): ImageRun {
  const [header, base64] = dataUrl.split(",");
  const buffer = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const maxWidth = 500;
  const scale = Math.min(1, maxWidth / width);
  const finalWidth = Math.round(width * scale);
  const finalHeight = Math.round(height * scale);
  const imageType =
    header.includes("image/jpeg") || header.includes("image/jpg")
      ? "jpg"
      : "png";

  return new ImageRun({
    data: buffer,
    transformation: { width: finalWidth, height: finalHeight },
    type: imageType,
  });
}

export async function exportToDOCX(
  editorHtml: string,
  files: AttachedFile[],
  fileName: string,
): Promise<void> {
  try {
    const { html: mainHtml } = buildPreviewHtml(editorHtml, files);
    const content: (Paragraph | Table)[] = parseHtmlToDocx(mainHtml);

    if (files.length > 0) {
      content.push(
        new Paragraph({
          children: [new TextRun({ text: "─".repeat(60), color: "2563EB" })],
          spacing: { before: 400, after: 400 },
        }),
      );

      content.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `Вложения (${files.length})`,
              bold: true,
              size: 28,
              color: "2563EB",
            }),
          ],
          spacing: { after: 200 },
        }),
      );

      const images = files.filter((f) => f.type === "image" && f.dataUrl);
      if (images.length > 0) {
        content.push(
          new Paragraph({
            children: [
              new TextRun({
                text: "Изображения",
                bold: true,
                size: 24,
                color: "2563EB",
              }),
            ],
            spacing: { before: 200, after: 200 },
          }),
        );

        images.forEach((img, i) => {
          content.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: `IMAGE_${i + 1}: ${img.name}`,
                  bold: true,
                  size: 22,
                  color: "2563EB",
                }),
              ],
              spacing: { after: 100 },
            }),
          );

          if (img.dataUrl && img.width && img.height) {
            content.push(
              new Paragraph({
                children: [createDocxImage(img.dataUrl, img.width, img.height)],
                spacing: { after: 300 },
              }),
            );
          }
        });
      }

      const textFiles = files.filter((f) => f.type === "text" && f.content);
      if (textFiles.length > 0) {
        content.push(
          new Paragraph({
            children: [
              new TextRun({
                text: "Текстовые файлы",
                bold: true,
                size: 24,
                color: "059669",
              }),
            ],
            spacing: { before: 200, after: 200 },
          }),
        );

        textFiles.forEach((file, i) => {
          content.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: `FILE_${i + 1}: ${file.name}`,
                  bold: true,
                  size: 22,
                  color: "059669",
                }),
              ],
              spacing: { after: 100 },
            }),
          );

          file.content?.split("\n").forEach((line) => {
            content.push(
              new Paragraph({
                children: [
                  new TextRun({ text: line, font: "Courier New", size: 20 }),
                ],
                spacing: { after: 50 },
              }),
            );
          });
        });
      }
    }

    const doc = new Document({
      sections: [{ children: content }],
      creator: "Tomte",
      title: fileName,
    });

    const blob = await Packer.toBlob(doc);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${sanitizeFileName(fileName)}.docx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error("DOCX Export Error:", error);
    throw new Error(
      `Ошибка экспорта DOCX: ${error instanceof Error ? error.message : "Неизвестная ошибка"}`,
    );
  }
}
