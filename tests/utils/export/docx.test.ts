import { describe, it, expect } from "vitest";
import { Packer } from "docx";
import { strFromU8, unzipSync } from "fflate";

import { buildDocxDocument } from "../../../src/utils/export/docx";
import type { ExportFile } from "../../../src/types";

/** Собирает DOCX и возвращает XML основных частей. */
async function render(
  html: string,
  files: ExportFile[] = [],
  preset: "default" | "gost" = "default",
) {
  const buffer = await Packer.toBuffer(
    buildDocxDocument(html, files, "test", preset),
  );
  const zip = unzipSync(new Uint8Array(buffer));
  const read = (name: string) => (zip[name] ? strFromU8(zip[name]) : "");
  const footers = Object.keys(zip)
    .filter((n) => /^word\/footer\d*\.xml$/.test(n))
    .map(read);
  return {
    document: read("word/document.xml"),
    styles: read("word/styles.xml"),
    footers,
  };
}

/** Тексты run'ов вместе с их свойствами: [{ text, props }]. */
function runs(documentXml: string) {
  return [...documentXml.matchAll(/<w:r>(.*?)<\/w:r>/gs)].map((m) => ({
    text: [...m[1].matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)]
      .map((t) => t[1])
      .join(""),
    props: m[1],
  }));
}

describe("DOCX: форматирование", () => {
  // Раньше внешнее форматирование терялось: <b>a <i>b</i></b> давало b только курсивом.
  it("вложенное форматирование наследуется", async () => {
    const { document } = await render(
      "<p><strong>жирный <em>и курсив</em></strong></p>",
    );
    const nested = runs(document).find((r) => r.text === "и курсив");

    expect(nested?.props).toContain("<w:b/>");
    expect(nested?.props).toContain("<w:i/>");
  });

  it("ссылки становятся гиперссылками", async () => {
    const { document } = await render(
      '<p>см. <a href="https://example.com">доку</a></p>',
    );
    expect(document).toContain("<w:hyperlink");
    expect(document).toContain("доку");
  });

  it("форматирование внутри пунктов списка сохраняется", async () => {
    const { document } = await render(
      "<ul><li><p>пункт <strong>важный</strong></p></li></ul>",
    );
    const bold = runs(document).find((r) => r.text === "важный");
    expect(bold?.props).toContain("<w:b/>");
    expect(document).toContain("• ");
  });

  it("содержимое файлов не дублируется", async () => {
    const files: ExportFile[] = [
      {
        id: "a",
        name: "a.md",
        size: 10,
        type: "text",
        content: "UNIQUE_CONTENT",
        label: "FILE_1",
      },
    ];
    const { document } = await render("<p>смотри [FILE_1: a.md]</p>", files);
    expect(document.match(/UNIQUE_CONTENT/g)).toHaveLength(1);
    expect(document).toContain("FILE_1: a.md");
  });
});

describe("DOCX по ГОСТ 7.32", () => {
  it("поля страницы 30/15/20/20 мм и нумерация внизу по центру", async () => {
    const { document, footers } = await render("<p>текст</p>", [], "gost");
    // 1 мм = 56.7 twip
    expect(document).toMatch(/<w:pgMar[^>]*w:top="1134"/);
    expect(document).toMatch(/<w:pgMar[^>]*w:right="850"/);
    expect(document).toMatch(/<w:pgMar[^>]*w:bottom="1134"/);
    expect(document).toMatch(/<w:pgMar[^>]*w:left="1701"/);
    expect(footers.join("")).toContain("PAGE");
    expect(footers.join("")).toContain('w:val="center"');
  });

  it("Times New Roman 14, интервал 1,5, отступ 1,25 см, по ширине", async () => {
    const { document, styles } = await render("<p>абзац</p>", [], "gost");
    expect(styles).toContain('w:ascii="Times New Roman"');
    expect(styles).toMatch(/<w:sz w:val="28"\/>/);
    expect(document).toContain('w:line="360"');
    expect(document).toContain('w:firstLine="709"');
    expect(document).toContain('w:val="both"');
  });

  it("заголовок полужирный, без точки в конце; перечисления через тире", async () => {
    const { document } = await render(
      "<h2>Постановка задачи.</h2><ul><li><p>пункт</p></li></ul>",
      [],
      "gost",
    );
    const heading = runs(document).find((r) => r.text.startsWith("Постановка"));
    expect(heading?.text).toBe("Постановка задачи");
    expect(heading?.props).toContain("<w:b/>");
    expect(document).toContain("– ");
  });

  it("обычный пресет не трогает поля и не нумерует страницы", async () => {
    const { document, footers } = await render("<p>текст</p>");
    expect(document).not.toMatch(/w:left="1701"/);
    expect(footers.join("")).not.toContain("PAGE");
  });
});
