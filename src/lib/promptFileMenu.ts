import { get } from "svelte/store";

import { translate } from "./i18n";

import type { PromptFile } from "../types";
import type { ContextMenuItem } from "../stores/contextMenu";
import { openFileIds } from "../stores";
import {
  closeOtherTabs,
  closePromptFileTab,
  deletePromptFileWithUndo,
  duplicatePromptFile,
  pinPromptFile,
  previewPromptFile,
} from "../utils/projectActions";
import { getErrorMessage } from "../utils";
import { formatHotkey, hotkeyFor } from "./hotkeys";
import { notifyError, notifyUndo } from "./notify";

/**
 * Пункты контекстного меню файла промпта (решение этапа 5).
 * Одинаковы во вкладке и в панели, отличаются только «Открыть» и «Закрыть».
 */
export function promptFileMenu(
  file: PromptFile,
  place: "tab" | "sidebar",
  onRename: () => void,
): ContextMenuItem[] {
  const isPinned = get(openFileIds).includes(file.id);
  const items: ContextMenuItem[] = [];

  if (place === "sidebar") {
    items.push({
      label: translate("menu.open"),
      onSelect: () => void previewPromptFile(file.id),
    });
  }
  if (!isPinned) {
    items.push({
      label: translate("menu.pin"),
      onSelect: () => void pinPromptFile(file.id),
    });
  }
  items.push(
    { label: translate("common.rename"), onSelect: onRename },
    {
      label: translate("common.duplicate"),
      onSelect: () => void duplicatePromptFile(file.id),
    },
  );
  if (place === "tab") {
    items.push({
      label: translate("common.close"),
      hint: formatHotkey(hotkeyFor("closeTab").keys),
      separatorBefore: true,
      onSelect: () => void closePromptFileTab(file.id),
    });
  }
  items.push({
    label: translate("menu.closeOthers"),
    separatorBefore: place === "sidebar",
    onSelect: () => void closeOtherTabs(file.id),
  });
  items.push({
    label: translate("common.delete"),
    danger: true,
    separatorBefore: true,
    onSelect: async () => {
      try {
        const undo = await deletePromptFileWithUndo(file.id);
        if (undo)
          notifyUndo(translate("prompts.deleted", { name: file.name }), undo);
      } catch (error) {
        notifyError(getErrorMessage(error, translate("prompts.errors.delete")));
      }
    },
  });
  return items;
}
