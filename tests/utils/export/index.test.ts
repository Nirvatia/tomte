import { describe, it, expect, vi, beforeEach } from "vitest";
import { exportFile } from "../../../src/utils/export/index";
import { exportToDOCX } from "../../../src/utils/export/docx";
import { exportToMD } from "../../../src/utils/export/md";
import { exportToPDF } from "../../../src/utils/export/pdf";
import { exportToPNG } from "../../../src/utils/export/png";
import { validateExportLimits } from "../../../src/utils/export/limits";
import type { AttachedFile } from "../../../src/types";

vi.mock("../../../src/utils/export/docx", () => ({
  exportToDOCX: vi.fn(),
}));

vi.mock("../../../src/utils/export/md", () => ({
  exportToMD: vi.fn(),
}));

vi.mock("../../../src/utils/export/pdf", () => ({
  exportToPDF: vi.fn(),
}));

vi.mock("../../../src/utils/export/png", () => ({
  exportToPNG: vi.fn(),
}));

vi.mock("../../../src/utils/export/limits", () => ({
  validateExportLimits: vi.fn(),
}));

const files: AttachedFile[] = [];

describe("exportFile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("вызывает validateExportLimits перед экспортом", async () => {
    await exportFile("md", "<p>text</p>", files, "test");
    expect(validateExportLimits).toHaveBeenCalledWith("md", files);
  });

  it("вызывает exportToMD для формата md", async () => {
    await exportFile("md", "<p>text</p>", files, "test");
    expect(exportToMD).toHaveBeenCalledWith("<p>text</p>", files, "test");
  });

  it("вызывает exportToPDF для формата pdf", async () => {
    await exportFile("pdf", "<p>text</p>", files, "test");
    expect(exportToPDF).toHaveBeenCalledWith("<p>text</p>", files, "test", {});
  });

  it("передаёт options в exportToPDF", async () => {
    const options = { openInNewTab: true };
    await exportFile("pdf", "<p>text</p>", files, "test", options);
    expect(exportToPDF).toHaveBeenCalledWith("<p>text</p>", files, "test", options);
  });

  it("вызывает exportToDOCX для формата docx", async () => {
    await exportFile("docx", "<p>text</p>", files, "test");
    expect(exportToDOCX).toHaveBeenCalledWith("<p>text</p>", files, "test");
  });

  it("вызывает exportToPNG для формата png", async () => {
    await exportFile("png", "<p>text</p>", files, "test");
    expect(exportToPNG).toHaveBeenCalledWith("<p>text</p>", files, "test");
  });

  it("бросает ошибку для неподдерживаемого формата", async () => {
    await expect(
      exportFile("xyz" as any, "<p>text</p>", files, "test"),
    ).rejects.toThrow("Неподдерживаемый формат экспорта");
  });

  it("пробрасывает ошибку из экспортёра", async () => {
    vi.mocked(exportToMD).mockRejectedValue(new Error("MD failed"));
    await expect(
      exportFile("md", "<p>text</p>", files, "test"),
    ).rejects.toThrow("MD failed");
  });

  it("пробрасывает ошибку из validateExportLimits", async () => {
    vi.mocked(validateExportLimits).mockImplementation(() => {
      throw new Error("Too many files");
    });
    await expect(
      exportFile("pdf", "<p>text</p>", files, "test"),
    ).rejects.toThrow("Too many files");
  });
});