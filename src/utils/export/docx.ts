import {
  AlignmentType,
  BorderStyle,
  Document,
  ExternalHyperlink,
  Footer,
  HeadingLevel,
  ImageRun,
  Packer,
  PageNumber,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  type IParagraphOptions,
  type ParagraphChild,
} from "docx";

import { get } from "svelte/store";

import type { ExportFile } from "../../types";
import { locale, translate, translateIn, type Locale } from "$lib/i18n";
import type { MessageKey } from "$lib/i18n/types";
import { sanitizeFileName } from "../index";
import { downloadBlob, exportTitle } from "./common";

// ════════════════════════════════════════════
// Стили
// ════════════════════════════════════════════

export type DocxPreset = "default" | "gost";

/** Размеры шрифта в docx задаются в половинах пункта: 28 = 14 pt. */
const pt = (points: number) => points * 2;
/** Миллиметры в twip (1/20 пункта) с округлением: библиотечный convertMillimetersToTwip отбрасывает дробь. */
const mm = (value: number) => Math.round((value * 1440) / 25.4);
const cm = (value: number) => mm(value * 10);
/** Межстрочный интервал: 240 = одинарный. */
const lineSpacing = (multiplier: number) => Math.round(240 * multiplier);

type Alignment = (typeof AlignmentType)[keyof typeof AlignmentType];

export interface DocxStyle {
  font: string;
  size: number;
  color?: string;
  codeFont: string;
  codeSize: number;
  tableSize: number;
  headingSizes: [number, number, number];
  heading: Pick<IParagraphOptions, "alignment" | "indent" | "spacing">;
  /** Убирать точку в конце заголовка (ГОСТ). */
  stripHeadingPeriod: boolean;
  paragraph: {
    alignment: Alignment;
    firstLine: number;
    line: number;
    after: number;
  };
  listIndentStep: number;
  bullet: string;
  orderedSuffix: string;
  accent: string;
  /** Ключ заголовка раздела вложений. */
  attachmentsTitle: MessageKey;
  /** Язык подписей документа. Не задан — язык интерфейса. ГОСТ — всегда русский. */
  lang?: Locale;
  attachmentsOnNewPage: boolean;
  page?: { top: number; right: number; bottom: number; left: number };
  pageNumbers: boolean;
  /** Подписи «Рисунок N — …» по центру под картинками. */
  figureCaptions: boolean;
}

const DEFAULT_STYLE: DocxStyle = {
  font: "Calibri",
  size: pt(12),
  codeFont: "Courier New",
  codeSize: pt(10),
  tableSize: pt(11),
  headingSizes: [pt(24), pt(18), pt(14)],
  heading: { spacing: { before: 240, after: 120 } },
  stripHeadingPeriod: false,
  paragraph: {
    alignment: AlignmentType.LEFT,
    firstLine: 0,
    line: lineSpacing(1.15),
    after: 100,
  },
  listIndentStep: 360,
  bullet: "•",
  orderedSuffix: ".",
  accent: "2563EB",
  attachmentsTitle: "export.docx.attachments",
  attachmentsOnNewPage: false,
  pageNumbers: false,
  figureCaptions: false,
};

/**
 * ГОСТ 7.32-2017 (отчёт о НИР), раздел 6:
 * поля: левое 30, правое 15, верхнее и нижнее 20 мм; Times New Roman 14 pt,
 * чёрный; полуторный интервал; абзацный отступ 1,25 см; выравнивание по ширине;
 * заголовки с абзацного отступа полужирным, без точки в конце;
 * перечисления через тире; номер страницы внизу по центру;
 * подписи «Рисунок N — Название» по центру под рисунком.
 */
const GOST_STYLE: DocxStyle = {
  font: "Times New Roman",
  size: pt(14),
  color: "000000",
  codeFont: "Courier New",
  codeSize: pt(12),
  tableSize: pt(12),
  headingSizes: [pt(14), pt(14), pt(14)],
  heading: {
    alignment: AlignmentType.LEFT,
    indent: { firstLine: cm(1.25) },
    spacing: { before: 240, after: 240, line: lineSpacing(1.5) },
  },
  stripHeadingPeriod: true,
  paragraph: {
    alignment: AlignmentType.JUSTIFIED,
    firstLine: cm(1.25),
    line: lineSpacing(1.5),
    after: 0,
  },
  listIndentStep: cm(1.25),
  bullet: "–",
  orderedSuffix: ")",
  accent: "000000",
  attachmentsTitle: "export.docx.gostAttachments",
  lang: "ru",
  attachmentsOnNewPage: true,
  page: {
    top: mm(20),
    right: mm(15),
    bottom: mm(20),
    left: mm(30),
  },
  pageNumbers: true,
  figureCaptions: true,
};

export const DOCX_STYLES: Record<DocxPreset, DocxStyle> = {
  default: DEFAULT_STYLE,
  gost: GOST_STYLE,
};

// ════════════════════════════════════════════
// Инлайн-текст
// ════════════════════════════════════════════

interface RunFormat {
  bold?: boolean;
  italics?: boolean;
  underline?: boolean;
  strike?: boolean;
  highlight?: boolean;
  code?: boolean;
}

/** Формат, который добавляет тег. Наследуется вглубь: <b><i>x</i></b> — жирный курсив. */
function formatForTag(tag: string, parent: RunFormat): RunFormat {
  switch (tag) {
    case "strong":
    case "b":
      return { ...parent, bold: true };
    case "em":
    case "i":
      return { ...parent, italics: true };
    case "u":
      return { ...parent, underline: true };
    case "s":
    case "strike":
    case "del":
      return { ...parent, strike: true };
    case "mark":
      return { ...parent, highlight: true };
    case "code":
      return { ...parent, code: true };
    default:
      return parent;
  }
}

function textRun(
  text: string,
  format: RunFormat,
  style: DocxStyle,
  options: { color?: string; size?: number } = {},
): TextRun {
  return new TextRun({
    text,
    font: format.code ? style.codeFont : style.font,
    size: options.size ?? (format.code ? style.codeSize : style.size),
    color: options.color ?? style.color,
    bold: format.bold,
    italics: format.italics,
    underline: format.underline ? {} : undefined,
    strike: format.strike,
    highlight: format.highlight ? "yellow" : undefined,
  });
}

function inlineRuns(
  node: Node,
  style: DocxStyle,
  format: RunFormat = {},
  size?: number,
): ParagraphChild[] {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent ?? "";
    return text ? [textRun(text, format, style, { size })] : [];
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return [];

  const el = node as HTMLElement;
  const tag = el.tagName.toLowerCase();

  if (tag === "br") return [new TextRun({ break: 1 })];
  if (tag === "img") {
    const image = imageFromElement(el as HTMLImageElement);
    return image ? [image] : [];
  }
  if (tag === "a") {
    const linkFormat = { ...format, underline: true };
    const runs = Array.from(el.childNodes).flatMap((child) =>
      inlineRuns(child, style, linkFormat, size),
    );
    const href = el.getAttribute("href");
    if (!href) return runs;
    return [
      new ExternalHyperlink({
        link: href,
        children: runs.filter((c): c is TextRun => c instanceof TextRun),
      }),
    ];
  }

  const childFormat = formatForTag(tag, format);
  return Array.from(el.childNodes).flatMap((child) =>
    inlineRuns(child, style, childFormat, size),
  );
}

// ════════════════════════════════════════════
// Картинки
// ════════════════════════════════════════════

const MAX_IMAGE_WIDTH_PX = 600;

function createDocxImage(
  dataUrl: string,
  width: number,
  height: number,
): ImageRun | null {
  const [header, base64] = dataUrl.split(",");
  if (!base64) return null;
  const isJpeg = header.includes("image/jpeg") || header.includes("image/jpg");
  // В DOCX встраиваем только PNG и JPEG; остальное подписываем текстом.
  if (!isJpeg && !header.includes("image/png")) return null;

  const buffer = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const scale = Math.min(1, MAX_IMAGE_WIDTH_PX / width);
  return new ImageRun({
    data: buffer,
    transformation: {
      width: Math.round(width * scale),
      height: Math.round(height * scale),
    },
    type: isJpeg ? "jpg" : "png",
  });
}

function imageFromElement(img: HTMLImageElement): ImageRun | null {
  const src = img.getAttribute("src") ?? "";
  if (!src.startsWith("data:")) return null;
  const width = Number(img.getAttribute("width")) || img.naturalWidth || 400;
  const height = Number(img.getAttribute("height")) || img.naturalHeight || 300;
  return createDocxImage(src, width, height);
}

// ════════════════════════════════════════════
// Блоки
// ════════════════════════════════════════════

type Block = Paragraph | Table;

class DocxBuilder {
  readonly blocks: Block[] = [];
  private figureCounter = 0;

  private readonly lang: Locale;

  constructor(private readonly style: DocxStyle) {
    this.lang = style.lang ?? get(locale);
  }

  /** Подпись на языке документа. */
  private t(key: MessageKey, params?: Record<string, string | number>): string {
    return translateIn(this.lang, key, params);
  }

  private paragraph(
    children: ParagraphChild[],
    options: Partial<IParagraphOptions> = {},
  ): void {
    const { paragraph } = this.style;
    this.blocks.push(
      new Paragraph({
        alignment: paragraph.alignment,
        indent: { firstLine: paragraph.firstLine },
        spacing: { line: paragraph.line, after: paragraph.after },
        ...options,
        children,
      }),
    );
  }

  private heading(text: string, level: 1 | 2 | 3): void {
    const headingLevel = [
      HeadingLevel.HEADING_1,
      HeadingLevel.HEADING_2,
      HeadingLevel.HEADING_3,
    ][level - 1];
    this.blocks.push(
      new Paragraph({
        heading: headingLevel,
        keepNext: true,
        ...this.style.heading,
        children: [
          textRun(
            this.style.stripHeadingPeriod ? text.replace(/\.+\s*$/, "") : text,
            { bold: true },
            this.style,
            { size: this.style.headingSizes[level - 1] },
          ),
        ],
      }),
    );
  }

  private codeLines(text: string): void {
    const lines = text.replace(/\n$/, "").split("\n");
    lines.forEach((line, index) => {
      this.blocks.push(
        new Paragraph({
          alignment: AlignmentType.LEFT,
          // Отступ перед блоком, чтобы код не прилипал к предыдущему абзацу.
          spacing: {
            line: lineSpacing(1),
            before: index === 0 ? 120 : 0,
            after: 0,
          },
          children: [textRun(line || " ", { code: true }, this.style)],
        }),
      );
    });
    this.blocks.push(new Paragraph({ children: [] }));
  }

  private figure(image: ImageRun, caption: string): void {
    const { figureCaptions } = this.style;
    this.blocks.push(
      new Paragraph({
        alignment: figureCaptions ? AlignmentType.CENTER : AlignmentType.LEFT,
        keepNext: figureCaptions,
        spacing: { before: 120, after: 120 },
        children: [image],
      }),
    );
    if (!figureCaptions) return;
    this.figureCounter += 1;
    this.blocks.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 240, line: this.style.paragraph.line },
        children: [
          textRun(
            this.t("export.docx.figure", { n: this.figureCounter, caption }),
            {},
            this.style,
          ),
        ],
      }),
    );
  }

  html(html: string): void {
    const doc = new DOMParser().parseFromString(html, "text/html");
    Array.from(doc.body.childNodes).forEach((node) => this.block(node));
  }

  private block(node: Node): void {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent?.trim();
      if (text) this.paragraph([textRun(text, {}, this.style)]);
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;

    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();

    switch (tag) {
      case "h1":
      case "h2":
      case "h3":
        this.heading(el.textContent ?? "", Number(tag[1]) as 1 | 2 | 3);
        return;
      case "p": {
        const runs = inlineRuns(el, this.style);
        this.paragraph(runs.length ? runs : [new TextRun("")]);
        return;
      }
      case "ul":
      case "ol":
        this.list(el, tag === "ol", 0);
        return;
      case "blockquote":
        for (const child of Array.from(el.childNodes)) {
          const runs = inlineRuns(child, this.style, { italics: true });
          if (runs.length === 0) continue;
          this.paragraph(runs, {
            indent: { left: this.style.listIndentStep },
            border: {
              left: {
                style: BorderStyle.SINGLE,
                size: 12,
                color: this.style.accent,
                space: 10,
              },
            },
          });
        }
        return;
      case "pre":
        this.codeLines(el.textContent ?? "");
        return;
      case "table":
        this.table(el);
        return;
      case "img": {
        const image = imageFromElement(el as HTMLImageElement);
        if (image) {
          this.figure(
            image,
            el.getAttribute("alt") || this.t("export.docx.image"),
          );
        }
        return;
      }
      case "hr":
        this.paragraph([], {
          border: {
            bottom: {
              style: BorderStyle.SINGLE,
              size: 6,
              color: "999999",
              space: 1,
            },
          },
        });
        return;
      default:
        Array.from(el.childNodes).forEach((child) => this.block(child));
    }
  }

  private list(listEl: HTMLElement, ordered: boolean, level: number): void {
    const items = Array.from(listEl.children).filter(
      (c) => c.tagName.toLowerCase() === "li",
    );
    items.forEach((li, index) => {
      const marker = ordered
        ? `${index + 1}${this.style.orderedSuffix} `
        : `${this.style.bullet} `;
      const runs: ParagraphChild[] = [textRun(marker, {}, this.style)];
      const nested: HTMLElement[] = [];

      for (const child of Array.from(li.childNodes)) {
        const childTag =
          child.nodeType === Node.ELEMENT_NODE
            ? (child as HTMLElement).tagName.toLowerCase()
            : "";
        if (childTag === "ul" || childTag === "ol") {
          nested.push(child as HTMLElement);
        } else {
          runs.push(...inlineRuns(child, this.style));
        }
      }

      const { paragraph, listIndentStep } = this.style;
      // Без абзацного отступа (обычный стиль) сдвигаем список целиком;
      // с отступом (ГОСТ) пункт начинается с абзацного отступа, вложенные — глубже.
      const left = paragraph.firstLine
        ? level * listIndentStep
        : (level + 1) * listIndentStep;
      this.paragraph(runs, {
        indent: { left, firstLine: paragraph.firstLine },
      });
      nested.forEach((list) =>
        this.list(list, list.tagName.toLowerCase() === "ol", level + 1),
      );
    });
  }

  private table(tableEl: HTMLElement): void {
    const rows = Array.from(tableEl.querySelectorAll("tr"));
    if (rows.length === 0) return;

    const tableRows = rows.map((row) => {
      const cells = Array.from(row.querySelectorAll("th, td"));
      return new TableRow({
        tableHeader: cells.every((c) => c.tagName.toLowerCase() === "th"),
        children: cells.map((cell) => {
          const isHeader = cell.tagName.toLowerCase() === "th";
          const runs = inlineRuns(
            cell,
            this.style,
            { bold: isHeader },
            this.style.tableSize,
          );
          return new TableCell({
            children: [
              new Paragraph({
                spacing: { line: lineSpacing(1), after: 0 },
                children: runs.length ? runs : [new TextRun("")],
              }),
            ],
            width: { size: 100 / cells.length, type: WidthType.PERCENTAGE },
            margins: { top: 80, bottom: 80, left: 120, right: 120 },
          });
        }),
      });
    });

    this.blocks.push(
      new Table({
        rows: tableRows,
        width: { size: 100, type: WidthType.PERCENTAGE },
      }),
    );
    this.blocks.push(new Paragraph({ children: [] }));
  }

  attachments(files: ExportFile[]): void {
    const images = files.filter((f) => f.type === "image" && f.dataUrl);
    const texts = files.filter((f) => f.type === "text" && f.content);
    if (images.length === 0 && texts.length === 0) return;

    const { style } = this;
    this.blocks.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        pageBreakBefore: style.attachmentsOnNewPage,
        keepNext: true,
        ...style.heading,
        children: [
          textRun(this.t(style.attachmentsTitle), { bold: true }, style, {
            size: style.headingSizes[0],
            color: style.accent,
          }),
        ],
      }),
    );

    for (const file of images) {
      const title = exportTitle(file, files);
      const image =
        file.dataUrl && file.width && file.height
          ? createDocxImage(file.dataUrl, file.width, file.height)
          : null;
      if (!image) {
        this.paragraph([
          textRun(this.t("export.docx.unsupportedImage", { title }), {}, style),
        ]);
        continue;
      }
      if (!style.figureCaptions) {
        this.paragraph(
          [textRun(title, { bold: true }, style, { color: style.accent })],
          { keepNext: true },
        );
      }
      this.figure(image, title);
    }

    for (const file of texts) {
      this.paragraph(
        [
          textRun(exportTitle(file, files), { bold: true }, style, {
            color: style.accent,
          }),
        ],
        {
          keepNext: true,
          spacing: { before: 240, after: 120, line: style.paragraph.line },
        },
      );
      this.codeLines(file.content ?? "");
    }
  }
}

// ════════════════════════════════════════════
// Документ
// ════════════════════════════════════════════

/**
 * Собирает документ: текст редактора, затем раздел вложений.
 * Плейсхолдеры [IMAGE_n]/[FILE_n] остаются в тексте ссылками на этот раздел.
 */
export function buildDocxDocument(
  editorHtml: string,
  files: ExportFile[],
  title: string,
  preset: DocxPreset = "default",
): Document {
  const style = DOCX_STYLES[preset];
  const builder = new DocxBuilder(style);
  builder.html(editorHtml);
  builder.attachments(files);

  const footer = style.pageNumbers
    ? new Footer({
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                children: [PageNumber.CURRENT],
                font: style.font,
                size: style.size,
              }),
            ],
          }),
        ],
      })
    : undefined;

  return new Document({
    creator: "Tomte",
    title,
    styles: {
      default: {
        document: {
          run: { font: style.font, size: style.size, color: style.color },
        },
      },
    },
    sections: [
      {
        properties: style.page ? { page: { margin: style.page } } : {},
        footers: footer ? { default: footer } : undefined,
        children: builder.blocks,
      },
    ],
  });
}

export async function exportToDOCX(
  editorHtml: string,
  files: ExportFile[],
  fileName: string,
  preset: DocxPreset = "default",
): Promise<void> {
  try {
    const doc = buildDocxDocument(editorHtml, files, fileName, preset);
    const blob = await Packer.toBlob(doc);
    downloadBlob(blob, `${sanitizeFileName(fileName)}.docx`);
  } catch (error) {
    console.error("DOCX Export Error:", error);
    throw new Error(
      translate("export.failed", {
        format: "DOCX",
        reason:
          error instanceof Error
            ? error.message
            : translate("common.unknownError"),
      }),
    );
  }
}
