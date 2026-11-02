import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Editor } from "@tiptap/core";

import { buildExtensions } from "../../../../src/lib/tiptap/config";

const TREE = "repo/\nsrc\n└── a.ts\n";

/**
 * StarterKit 3 (TrailingNode) держит пустой абзац в конце документа после блоков,
 * чтобы после них можно было печатать. Для сравнения его отбрасываем.
 */
function html(editor: Editor): string {
  return editor.getHTML().replace(/<p><\/p>$/, "");
}

describe("ProjectTreeBlock", () => {
  let editor: Editor;
  let container: HTMLDivElement;

  function create(content: string) {
    editor = new Editor({
      element: container,
      extensions: buildExtensions(),
      content,
    });
  }

  /** Ставит курсор в конец текста первого абзаца. */
  function cursorAtEndOf(text: string) {
    let target = 0;
    editor.state.doc.descendants((node, pos) => {
      if (node.isText && node.text === text) target = pos + node.nodeSize;
    });
    editor.commands.setTextSelection(target);
  }

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    editor.destroy();
    container.remove();
  });

  // Раньше setCodeBlock превращал абзац с курсором в блок кода, и текст пропадал в нём.
  it("не трогает абзац, в котором стоит курсор", () => {
    create("<p>Мой промпт</p><p>Второй абзац</p>");
    cursorAtEndOf("Мой промпт");

    editor.commands.insertProjectTree(TREE);

    expect(html(editor)).toBe(
      '<p>Мой промпт</p><pre data-type="project-tree"><code>repo/\nsrc\n└── a.ts</code></pre><p>Второй абзац</p>',
    );
  });

  it("заменяет пустой абзац под курсором", () => {
    create("<p>Текст</p><p></p>");
    editor.commands.setTextSelection(editor.state.doc.content.size - 1);

    editor.commands.insertProjectTree(TREE);

    expect(html(editor)).toBe(
      '<p>Текст</p><pre data-type="project-tree"><code>repo/\nsrc\n└── a.ts</code></pre>',
    );
  });

  it("повторная вставка обновляет дерево, а не добавляет второе", () => {
    create("<p>Текст</p>");
    cursorAtEndOf("Текст");
    editor.commands.insertProjectTree(TREE);
    editor.commands.insertProjectTree("other/\n");

    const html = editor.getHTML();
    expect(html.match(/data-type="project-tree"/g)).toHaveLength(1);
    expect(html).toContain("<code>other/</code>");
    expect(html).toContain("<p>Текст</p>");
  });

  it("removeProjectTree убирает блок и оставляет текст", () => {
    create("<p>Текст</p>");
    cursorAtEndOf("Текст");
    editor.commands.insertProjectTree(TREE);

    expect(editor.commands.removeProjectTree()).toBe(true);
    expect(html(editor)).toBe("<p>Текст</p>");
    expect(editor.commands.removeProjectTree()).toBe(false);
  });

  it("кнопка в блоке убирает дерево из промпта", () => {
    create("<p>Текст</p>");
    cursorAtEndOf("Текст");
    editor.commands.insertProjectTree(TREE);

    const button = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Убрать дерево из промпта"]',
    );
    expect(button).not.toBeNull();
    button!.click();

    expect(html(editor)).toBe("<p>Текст</p>");
  });

  it("переживает сохранение: сохранённый HTML снова открывается как блок дерева", () => {
    create("<p>Текст</p>");
    cursorAtEndOf("Текст");
    editor.commands.insertProjectTree(TREE);
    const saved = html(editor);

    editor.commands.setContent(saved);

    expect(html(editor)).toBe(saved);
    expect(container.querySelector(".project-tree-block")).not.toBeNull();
  });
});
