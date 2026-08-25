import { describe, it, expect } from "vitest";
import { validateExportLimits } from "../../src/utils/export/limits";
import type { AttachedFile } from "../../src/types";

function makeFiles(count: number, contentLength = 100): AttachedFile[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `file-${i}`,
    name: `file-${i}.md`,
    size: contentLength,
    type: "text" as const,
    content: "x".repeat(contentLength),
  }));
}

describe("validateExportLimits", () => {
  describe("markdown не имеет ограничений", () => {
    it("пропускает любое количество файлов", () => {
      expect(() => validateExportLimits("md", makeFiles(1000))).not.toThrow();
    });

    it("пропускает любой объём текста", () => {
      expect(() => validateExportLimits("md", makeFiles(1, 10_000_000))).not.toThrow();
    });
  });

  describe("pdf", () => {
    it("пропускает файлы в пределах лимита", () => {
      expect(() => validateExportLimits("pdf", makeFiles(20))).not.toThrow();
    });

    it("бросает ошибку при превышении количества файлов", () => {
      expect(() => validateExportLimits("pdf", makeFiles(21))).toThrow("Слишком много файлов");
      expect(() => validateExportLimits("pdf", makeFiles(21))).toThrow("PDF");
    });

    it("бросает ошибку при превышении объёма текста", () => {
      expect(() => validateExportLimits("pdf", makeFiles(1, 400_000))).toThrow("Слишком большой объём");
    });

    it("подсказывает использовать Markdown", () => {
      try {
        validateExportLimits("pdf", makeFiles(100));
        expect.fail("должно было бросить ошибку");
      } catch (e: any) {
        expect(e.message).toContain("Markdown");
      }
    });
  });

  describe("docx", () => {
    it("пропускает файлы в пределах лимита", () => {
      expect(() => validateExportLimits("docx", makeFiles(20))).not.toThrow();
    });

    it("бросает ошибку при превышении количества файлов", () => {
      expect(() => validateExportLimits("docx", makeFiles(21))).toThrow("Слишком много файлов");
    });
  });

  describe("png", () => {
    it("пропускает файлы в пределах лимита", () => {
      expect(() => validateExportLimits("png", makeFiles(10))).not.toThrow();
    });

    it("бросает ошибку при превышении количества файлов", () => {
      expect(() => validateExportLimits("png", makeFiles(11))).toThrow("Слишком много файлов");
    });

    it("бросает ошибку при превышении объёма текста", () => {
      expect(() => validateExportLimits("png", makeFiles(1, 200_000))).toThrow("Слишком большой объём");
    });
  });

  describe("пустой массив файлов", () => {
    it("проходит для любого формата", () => {
      expect(() => validateExportLimits("pdf", [])).not.toThrow();
      expect(() => validateExportLimits("docx", [])).not.toThrow();
      expect(() => validateExportLimits("png", [])).not.toThrow();
      expect(() => validateExportLimits("md", [])).not.toThrow();
    });
  });

  describe("файлы без контента", () => {
    it("не учитывает файлы без content в объёме", () => {
      const files: AttachedFile[] = Array.from({ length: 5 }, (_, i) => ({
        id: `file-${i}`,
        name: `file-${i}.png`,
        size: 1000,
        type: "image" as const,
        dataUrl: "data:image/png;base64,abc",
      }));

      expect(() => validateExportLimits("pdf", files)).not.toThrow();
    });
  });
});