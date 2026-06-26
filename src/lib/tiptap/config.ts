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

export function buildExtensions(): Extensions {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      // History включён по умолчанию — даёт Undo/Redo
    }),
    Underline,
    Highlight.configure({ multicolor: false }),
    TextAlign.configure({
      types: ["heading", "paragraph"],
      alignments: ["left", "center", "right"],
    }),
    Placeholder.configure({
      placeholder:
        "Введи свой промпт здесь...\n\nКликай по файлам справа, чтобы вставить плейсхолдер [IMAGE_1: ...] или [FILE_1: ...]",
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
  ];
}
