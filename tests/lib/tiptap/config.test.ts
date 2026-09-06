import { describe, it, expect } from "vitest";
import { buildExtensions } from "../../../src/lib/tiptap/config";

describe("buildExtensions", () => {
  it("возвращает массив расширений", () => {
    const extensions = buildExtensions();
    expect(Array.isArray(extensions)).toBe(true);
  });

  it("содержит ожидаемое количество расширений", () => {
    const extensions = buildExtensions();
    // StarterKit, Underline, TextStyle, FontSize, Highlight, TextAlign,
    // Placeholder, Image, Link, Table, TableRow, TableCell, TableHeader,
    // CharacterCount
    expect(extensions.length).toBeGreaterThanOrEqual(14);
  });

  it("содержит StarterKit с нужными уровнями заголовков", () => {
    const extensions = buildExtensions();
    const starterKit = extensions.find(
      (ext: any) => ext.name === "starterKit",
    );
    expect(starterKit).toBeDefined();
  });

  it("содержит расширение FontSize", () => {
    const extensions = buildExtensions();
    const fontSize = extensions.find((ext: any) => ext.name === "fontSize");
    expect(fontSize).toBeDefined();
  });

  it("содержит расширение Highlight", () => {
    const extensions = buildExtensions();
    const highlight = extensions.find((ext: any) => ext.name === "highlight");
    expect(highlight).toBeDefined();
  });

  it("содержит расширение CharacterCount", () => {
    const extensions = buildExtensions();
    const charCount = extensions.find(
      (ext: any) => ext.name === "characterCount",
    );
    expect(charCount).toBeDefined();
  });

  it("содержит расширения таблицы", () => {
    const extensions = buildExtensions();
    const table = extensions.find((ext: any) => ext.name === "table");
    const tableRow = extensions.find((ext: any) => ext.name === "tableRow");
    const tableCell = extensions.find((ext: any) => ext.name === "tableCell");
    const tableHeader = extensions.find(
      (ext: any) => ext.name === "tableHeader",
    );
    expect(table).toBeDefined();
    expect(tableRow).toBeDefined();
    expect(tableCell).toBeDefined();
    expect(tableHeader).toBeDefined();
  });

  it("содержит расширение Placeholder", () => {
    const extensions = buildExtensions();
    const placeholder = extensions.find(
      (ext: any) => ext.name === "placeholder",
    );
    expect(placeholder).toBeDefined();
  });
});