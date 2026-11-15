import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { Node as PMNode } from "@tiptap/pm/model";

/**
 * Этап 5.9. Подсветка меток вложений в тексте промпта: [IMAGE_1], [FILE_2].
 * Декорации вокруг найденных меток: акцентные плашки; метка, которой нет
 * среди вложений, подсвечивается как битая. Клик ловит TiptapEditor
 * по классу .attachment-ref — здесь только отрисовка.
 */

export const ATTACHMENT_REF_RE = /\[(IMAGE|FILE)_(\d+)\]/g;

export const attachmentRefKey = new PluginKey<{
  decorations: DecorationSet;
  known: Set<string>;
}>("attachmentRef");

interface RefState {
  decorations: DecorationSet;
  known: Set<string>;
}

function buildDecorations(doc: PMNode, known: Set<string>): DecorationSet {
  const decorations: Decoration[] = [];
  doc.descendants((node, position) => {
    if (!node.isText || !node.text) return;
    ATTACHMENT_REF_RE.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = ATTACHMENT_REF_RE.exec(node.text)) !== null) {
      const label = `${match[1]}_${match[2]}`;
      const from = position + match.index;
      const to = from + match[0].length;
      decorations.push(
        Decoration.inline(from, to, {
          class: `attachment-ref${known.has(label) ? "" : " is-broken"}`,
          "data-label": label,
        }),
      );
    }
  });
  return DecorationSet.create(doc, decorations);
}

/** knownLabels — текущие метки вложений; меняются через meta (см. PromptEditor). */
export function createAttachmentRefExtension(
  knownLabels: Set<string>,
): Extension {
  return Extension.create({
    name: "attachmentRef",

    addProseMirrorPlugins() {
      return [
        new Plugin<RefState>({
          key: attachmentRefKey,
          state: {
            init: (_, state) => ({
              decorations: buildDecorations(state.doc, knownLabels),
              known: knownLabels,
            }),
            apply(tr, value) {
              const meta = tr.getMeta(attachmentRefKey) as
                { known?: Set<string> } | undefined;
              if (!tr.docChanged && !meta) return value;
              const known = meta?.known ?? value.known;
              return { decorations: buildDecorations(tr.doc, known), known };
            },
          },
          props: {
            decorations(state) {
              return this.getState(state)?.decorations;
            },
          },
        }),
      ];
    },
  });
}
