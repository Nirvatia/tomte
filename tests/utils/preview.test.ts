import { describe, it, expect } from "vitest";
import { buildPreviewHtml } from "../../src/utils/preview";
import { labelAttachments } from "../../src/utils/files";
import type { AttachedFile } from "../../src/types";

function makeTextFile(name: string, content: string): AttachedFile {
  return {
    id: `id-${name}`,
    name,
    size: content.length,
    type: "text",
    content,
  };
}

function makeImageFile(name: string): AttachedFile {
  return {
    id: `id-${name}`,
    name,
    size: 1000,
    type: "image",
    dataUrl: `data:image/png;base64,${name}`,
    width: 100,
    height: 100,
  };
}

describe("buildPreviewHtml", () => {
  it("возвращает исходный html без файлов", () => {
    const result = buildPreviewHtml("<p>hello</p>", []);

    expect(result.html).toBe("<p>hello</p>");
    expect(result.stats.totalFiles).toBe(0);
  });

  it("заменяет плейсхолдер изображения на тег img", () => {
    const files = [makeImageFile("photo.png")];
    const html = "<p>Смотри [IMAGE_1: photo.png]</p>";

    const result = buildPreviewHtml(html, files);

    expect(result.html).toContain("<img");
    expect(result.html).toContain("data:image/png;base64,photo.png");
    expect(result.stats.usedImages).toBe(1);
    expect(result.stats.unusedImages).toBe(0);
  });

  it("заменяет плейсхолдер без описания", () => {
    const files = [makeImageFile("photo.png")];
    const html = "<p>[IMAGE_1]</p>";

    const result = buildPreviewHtml(html, files);

    expect(result.html).toContain("<img");
    expect(result.stats.usedImages).toBe(1);
  });

  it("подсвечивает плейсхолдер текстового файла", () => {
    const files = [makeTextFile("readme.md", "# Hello")];
    const html = "<p>Читай [FILE_1: readme.md]</p>";

    const result = buildPreviewHtml(html, files);

    expect(result.html).toContain("preview-file-placeholder");
    expect(result.html).toContain("FILE_1");
    expect(result.stats.usedFiles).toBe(1);
  });

  it("отмечает неиспользованные изображения", () => {
    const files = [makeImageFile("unused.png")];
    const html = "<p>Без плейсхолдеров</p>";

    const result = buildPreviewHtml(html, files);

    expect(result.stats.unusedImages).toBe(1);
    expect(result.stats.usedImages).toBe(0);
    expect(result.html).toContain("preview-unused-image");
  });

  it("добавляет неиспользованный текст в конец", () => {
    const files = [makeTextFile("notes.md", "# Notes")];
    const html = "<p>Без плейсхолдеров</p>";

    const result = buildPreviewHtml(html, files);

    expect(result.stats.attachedTexts).toBe(1);
    expect(result.html).toContain("preview-appendix");
    expect(result.html).toContain("preview-attached-file");
    expect(result.html).toContain("# Notes");
  });

  // Раньше содержимое файла с плейсхолдером не попадало в PDF/PNG вовсе:
  // ссылка [FILE_1] вела в никуда.
  it("файл с плейсхолдером подсвечивается в тексте и попадает в приложение", () => {
    const files = [makeTextFile("notes.md", "# Notes")];
    const html = "<p>[FILE_1: notes.md]</p>";

    const result = buildPreviewHtml(html, files);

    expect(result.stats.usedFiles).toBe(1);
    expect(result.stats.attachedTexts).toBe(1);
    expect(result.html).toContain("preview-file-placeholder");
    expect(result.html).toContain("# Notes");
  });

  it("корректно считает статистику для смешанных файлов", () => {
    const files = [
      makeTextFile("a.md", "text a"),
      makeImageFile("img.png"),
      makeTextFile("b.md", "text b"),
    ];
    const html = "<p>[FILE_1: a.md] и [IMAGE_1: img.png]</p>";

    const result = buildPreviewHtml(html, files);

    expect(result.stats.totalFiles).toBe(3);
    expect(result.stats.usedFiles).toBe(1);
    expect(result.stats.unusedFiles).toBe(1);
    expect(result.stats.usedImages).toBe(1);
    expect(result.stats.unusedImages).toBe(0);
    expect(result.stats.attachedTexts).toBe(2);
  });

  describe("нумерация совпадает с редактором", () => {
    it("использует метки, посчитанные по всем вложениям, а не по отобранным", () => {
      const all = [makeImageFile("a.png"), makeImageFile("b.png")];
      // Пользователь отметил для экспорта только вторую картинку.
      const selected = labelAttachments([all[1]], all);
      const html = "<p>Смотри [IMAGE_2: b.png]</p>";

      const result = buildPreviewHtml(html, selected);

      expect(result.stats.usedImages).toBe(1);
      expect(result.html).toContain("data:image/png;base64,b.png");
      expect(result.html).not.toContain("[IMAGE_2: b.png]</p>");
      expect(result.html).not.toContain("без плейсхолдера");
    });

    it("[FILE_1] не совпадает с [FILE_10]", () => {
      const files = Array.from({ length: 10 }, (_, i) =>
        makeTextFile(`f${i + 1}.md`, `content ${i + 1}`),
      );
      const html = "<p>[FILE_10: f10.md]</p>";

      const result = buildPreviewHtml(html, files);

      expect(result.stats.usedFiles).toBe(1);
      expect(result.stats.unusedFiles).toBe(9);
    });

    it("файлы без метки (из дерева) подписываются только именем", () => {
      const attachment = { ...makeTextFile("a.md", "attached"), label: "FILE_1" };
      const treeFile = { ...makeTextFile("src/x.ts", "tree"), label: null };

      const result = buildPreviewHtml("<p>[FILE_1: a.md]</p>", [attachment, treeFile]);

      expect(result.html).toContain(">src/x.ts</div>");
      expect(result.stats.usedFiles).toBe(1);
    });
  });

  it("экранирует HTML в именах файлов", () => {
    const files = [makeImageFile('<script>alert("xss")</script>.png')];
    const html = "<p>[IMAGE_1]</p>";

    const result = buildPreviewHtml(html, files);

    expect(result.html).not.toContain("<script>");
    expect(result.html).toContain("&lt;script&gt;");
  });

  it("экранирует HTML в содержимом текстовых файлов", () => {
    const files = [makeTextFile("evil.md", '<img src=x onerror=alert(1)>')];
    const html = "<p>text</p>";

    const result = buildPreviewHtml(html, files);

    expect(result.html).not.toContain('onerror=alert(1)');
  });
});