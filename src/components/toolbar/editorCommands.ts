import type { Editor } from "@tiptap/core";

import { translate } from "$lib/i18n";
import { exportFormat } from "../../stores";
import { requestConfirm } from "../../stores/confirm";
import {
  clearActiveFileContent,
  clearAttachmentsFromProject,
  clearProjectTreeSource,
} from "../../utils/projectActions";

/**
 * Команды тулбара редактора (этап 15.2): общие для кнопок тулбара,
 * меню «Инструменты» и меню таблицы.
 */

export interface ToolbarState {
  canUndo: boolean;
  canRedo: boolean;
  /** Активные отметки и блоки под курсором: bold, h1, bulletList… */
  active: Set<string>;
  isInsideTable: boolean;
}

export const EMPTY_TOOLBAR_STATE: ToolbarState = {
  canUndo: false,
  canRedo: false,
  active: new Set(),
  isInsideTable: false,
};

const TRACKED: Array<[string, string, Record<string, unknown>?]> = [
  ["bold", "bold"],
  ["italic", "italic"],
  ["underline", "underline"],
  ["strike", "strike"],
  ["highlight", "highlight"],
  ["code", "code"],
  ["h1", "heading", { level: 1 }],
  ["h2", "heading", { level: 2 }],
  ["bulletList", "bulletList"],
  ["orderedList", "orderedList"],
  ["blockquote", "blockquote"],
];

export function readToolbarState(editor: Editor): ToolbarState {
  const active = new Set<string>();
  for (const [key, name, attrs] of TRACKED) {
    if (editor.isActive(name, attrs)) active.add(key);
  }
  return {
    canUndo: editor.can().undo(),
    canRedo: editor.can().redo(),
    active,
    isInsideTable: editor.isActive("table"),
  };
}

export function copyEditorText(editor: Editor | null): void {
  if (!editor) return;
  void navigator.clipboard.writeText(editor.getText());
}

export async function confirmClearText(editor: Editor | null): Promise<void> {
  if (!editor) return;
  const confirmed = await requestConfirm({
    title: translate("toolbar.clearText.title"),
    message: translate("toolbar.clearText.message"),
    confirmText: translate("common.clear"),
    cancelText: translate("common.cancel"),
    danger: true,
  });
  if (confirmed) editor.commands.clearContent();
}

/** «Очистить проект»: текст файла, вложения, дерево, формат экспорта. */
export async function confirmClearProject(
  editor: Editor | null,
): Promise<void> {
  const confirmed = await requestConfirm({
    title: translate("toolbar.clearProject.title"),
    message: translate("toolbar.clearProject.message"),
    confirmText: translate("common.clear"),
    cancelText: translate("common.cancel"),
    danger: true,
  });
  if (!confirmed) return;
  await clearActiveFileContent();
  editor?.commands.clearContent();
  await clearAttachmentsFromProject();
  await clearProjectTreeSource();
  exportFormat.set("pdf");
}

export async function confirmDeleteTable(editor: Editor | null): Promise<void> {
  if (!editor) return;
  const confirmed = await requestConfirm({
    title: translate("toolbar.deleteTable.title"),
    message: translate("toolbar.deleteTable.message"),
    confirmText: translate("common.delete"),
    cancelText: translate("common.cancel"),
    danger: true,
  });
  if (confirmed) editor.chain().focus().deleteTable().run();
}
