import { describe, it, expect } from "vitest";

import { diffLines, countChanges } from "../../src/utils/diff";

describe("diffLines (10.3)", () => {
  it("совпадающие тексты — только контекст", () => {
    const lines = diffLines("a\nb", "a\nb");
    expect(lines).toEqual([
      { type: "same", text: "a" },
      { type: "same", text: "b" },
    ]);
    expect(countChanges(lines)).toEqual({ added: 0, removed: 0 });
  });

  it("добавление и удаление строк", () => {
    const lines = diffLines("a\nb\nc", "a\nx\nc");
    expect(lines).toEqual([
      { type: "same", text: "a" },
      { type: "remove", text: "b" },
      { type: "add", text: "x" },
      { type: "same", text: "c" },
    ]);
    expect(countChanges(lines)).toEqual({ added: 1, removed: 1 });
  });

  it("пустая старая версия — всё добавлено", () => {
    const lines = diffLines("", "a\nb");
    expect(lines.every((l) => l.type === "add")).toBe(true);
  });

  it("работает с многобайтовыми строками", () => {
    const lines = diffLines("привет\nмир", "привет\npeace\nмир");
    expect(lines).toContainEqual({ type: "add", text: "peace" });
  });
});
