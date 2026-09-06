import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { TextStyle } from "@tiptap/extension-text-style";
import { FontSize } from "../../../../src/lib/tiptap/extensions/FontSize";

describe("FontSize extension", () => {
  let editor: Editor;
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);

    editor = new Editor({
      element: container,
      extensions: [StarterKit, TextStyle, FontSize],
      content: "<p>Hello world</p>",
    });
  });

  afterEach(() => {
    editor.destroy();
    document.body.removeChild(container);
  });

  it("расширение регистрируется с именем fontSize", () => {
    expect(FontSize.name).toBe("fontSize");
  });

  it("добавляет команды setFontSize и unsetFontSize", () => {
    expect(editor.commands.setFontSize).toBeDefined();
    expect(editor.commands.unsetFontSize).toBeDefined();
  });

  it("setFontSize применяет стиль к выделенному тексту", () => {
    // Выделяем весь текст
    editor.commands.selectAll();
    editor.commands.setFontSize("1.5rem");

    const html = editor.getHTML();
    expect(html).toContain("font-size: 1.5rem");
  });

  it("unsetFontSize убирает стиль", () => {
    editor.commands.selectAll();
    editor.commands.setFontSize("1.5rem");
    expect(editor.getHTML()).toContain("font-size: 1.5rem");

    editor.commands.unsetFontSize();
    expect(editor.getHTML()).not.toContain("font-size: 1.5rem");
  });

  it("getAttributes возвращает текущий размер шрифта", () => {
    editor.commands.selectAll();
    editor.commands.setFontSize("2rem");

    const attrs = editor.getAttributes("textStyle");
    expect(attrs.fontSize).toBe("2rem");
  });

  it("парсит font-size из HTML", () => {
    editor.commands.setContent(
      '<p><span style="font-size: 1.25rem">Text</span></p>',
    );
    editor.commands.selectAll();

    const attrs = editor.getAttributes("textStyle");
    expect(attrs.fontSize).toBe("1.25rem");
  });
});
