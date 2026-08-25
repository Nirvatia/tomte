import { describe, it, expect } from "vitest";
import { buildPreviewHtml } from "../../src/utils/preview";
import type { PreviewResult } from "../../src/utils/preview";
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

  it("не добавляет в конец если плейсхолдер уже есть", () => {
    const files = [makeTextFile("notes.md", "# Notes")];
    const html = "<p>[FILE_1: notes.md]</p>";

    const result = buildPreviewHtml(html, files);

    expect(result.stats.attachedTexts).toBe(0);
    expect(result.html).not.toContain("preview-appendix");
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
    expect(result.stats.attachedTexts).toBe(1);
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