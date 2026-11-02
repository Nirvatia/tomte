import { translate } from "$lib/i18n";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Placeholder from "@tiptap/extension-placeholder";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import Highlight from "@tiptap/extension-highlight";
import CharacterCount from "@tiptap/extension-character-count";
import type { Extensions } from "@tiptap/core";
import { TextStyle } from "@tiptap/extension-text-style";
import { FontSize } from "./extensions/FontSize";
import { ProjectTreeBlock } from "./extensions/ProjectTreeBlock";

export function buildExtensions(): Extensions {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      // History включён по умолчанию — даёт Undo/Redo.
      // StarterKit 3 сам включает link и underline; отключаем их,
      // потому что ниже они подключены со своими настройками.
      link: false,
      underline: false,
    }),
    Underline,
    TextStyle,
    FontSize,
    Highlight.configure({ multicolor: false }),
    TextAlign.configure({
      types: ["heading", "paragraph"],
      alignments: ["left", "center", "right"],
    }),
    Placeholder.configure({
      // Функция, а не строка: подпись берётся на текущем языке при отрисовке.
      placeholder: () => translate("editor.placeholder"),
      emptyEditorClass: "is-editor-empty",
    }),
    Image.configure({ inline: false, allowBase64: true }),
    Link.configure({
      openOnClick: false,
      HTMLAttributes: {
        class: "text-brand-600 underline hover:text-brand-700",
      },
    }),
    Table.configure({
      resizable: true,
      HTMLAttributes: { class: "tiptap-table" },
    }),
    TableRow,
    TableCell,
    TableHeader,
    CharacterCount,
    ProjectTreeBlock,
  ];
}
