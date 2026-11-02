import { Node, type JSONContent } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import type { EditorState } from "@tiptap/pm/state";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    projectTree: {
      /**
       * Вставляет дерево проекта отдельным блоком, не трогая текст вокруг.
       * Если дерево уже есть в документе, обновляет его на месте.
       */
      insertProjectTree: (text: string) => ReturnType;
      /** Убирает блок дерева из документа. */
      removeProjectTree: () => ReturnType;
    };
  }
}

export const PROJECT_TREE_NODE = "projectTree";

/** Позиция и размер первого блока дерева в документе. */
export function findProjectTree(
  doc: PMNode,
): { pos: number; node: PMNode } | null {
  let found: { pos: number; node: PMNode } | null = null;
  doc.descendants((node, pos) => {
    if (found) return false;
    if (node.type.name === PROJECT_TREE_NODE) {
      found = { pos, node };
      return false;
    }
    return true;
  });
  return found;
}

/**
 * Куда вставить новый блок: на место пустого абзаца под курсором,
 * иначе сразу после блока верхнего уровня, в котором стоит курсор.
 */
function insertionRange(state: EditorState): { from: number; to: number } {
  const { $from } = state.selection;
  if ($from.depth === 0) return { from: $from.pos, to: $from.pos };

  const topBlock = $from.node(1);
  const start = $from.before(1);
  const end = $from.after(1);
  if (topBlock.type.name === "paragraph" && topBlock.content.size === 0) {
    return { from: start, to: end };
  }
  return { from: end, to: end };
}

function treeContent(text: string): JSONContent {
  const body = text.replace(/\n+$/, "");
  return {
    type: PROJECT_TREE_NODE,
    content: body ? [{ type: "text", text: body }] : [],
  };
}

/**
 * Блок с деревом проекта. В HTML это <pre data-type="project-tree"><code>,
 * так что экспорт в Markdown/DOCX/PDF видит обычный блок кода.
 * В редакторе у блока есть подпись и кнопка «убрать из промпта».
 */
export const ProjectTreeBlock = Node.create({
  name: PROJECT_TREE_NODE,
  group: "block",
  content: "text*",
  marks: "",
  code: true,
  defining: true,
  // Приоритет расширения не поднимаем: первый блочный узел в схеме ProseMirror
  // считает блоком по умолчанию и начинает создавать его вместо абзаца.

  parseHTML() {
    return [
      {
        tag: 'pre[data-type="project-tree"]',
        preserveWhitespace: "full",
        // Выше правила codeBlock (50): иначе сохранённое дерево откроется обычным блоком кода.
        priority: 60,
      },
    ];
  },

  renderHTML() {
    return ["pre", { "data-type": "project-tree" }, ["code", 0]];
  },

  addNodeView() {
    return ({ editor, getPos }) => {
      const dom = document.createElement("div");
      dom.className = "project-tree-block";
      dom.dataset.type = "project-tree";

      const header = document.createElement("div");
      header.className = "project-tree-block__header";
      header.contentEditable = "false";

      const title = document.createElement("span");
      title.textContent = "Дерево проекта";

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "project-tree-block__remove";
      remove.textContent = "×";
      remove.title = "Убрать дерево из промпта";
      remove.setAttribute("aria-label", "Убрать дерево из промпта");
      remove.addEventListener("mousedown", (event) => event.preventDefault());
      remove.addEventListener("click", () => {
        const pos = typeof getPos === "function" ? getPos() : undefined;
        if (typeof pos !== "number") return;
        const node = editor.state.doc.nodeAt(pos);
        if (!node) return;
        editor
          .chain()
          .focus()
          .deleteRange({ from: pos, to: pos + node.nodeSize })
          .run();
      });

      header.append(title, remove);

      const pre = document.createElement("pre");
      const code = document.createElement("code");
      pre.append(code);
      dom.append(header, pre);

      return { dom, contentDOM: code };
    };
  },

  addCommands() {
    return {
      insertProjectTree:
        (text) =>
        ({ state, chain }) => {
          const existing = findProjectTree(state.doc);
          const range = existing
            ? { from: existing.pos, to: existing.pos + existing.node.nodeSize }
            : insertionRange(state);
          return chain().insertContentAt(range, treeContent(text)).run();
        },
      removeProjectTree:
        () =>
        ({ state, tr, dispatch }) => {
          const existing = findProjectTree(state.doc);
          if (!existing) return false;
          if (dispatch) {
            tr.delete(existing.pos, existing.pos + existing.node.nodeSize);
          }
          return true;
        },
    };
  },
});
