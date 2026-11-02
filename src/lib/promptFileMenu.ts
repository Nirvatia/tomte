import { get } from "svelte/store";

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
      label: "Открыть",
      onSelect: () => void previewPromptFile(file.id),
    });
  }
  if (!isPinned) {
    items.push({
      label: "Закрепить во вкладках",
      onSelect: () => void pinPromptFile(file.id),
    });
  }
  items.push(
    { label: "Переименовать", onSelect: onRename },
    { label: "Дублировать", onSelect: () => void duplicatePromptFile(file.id) },
  );
  if (place === "tab") {
    items.push({
      label: "Закрыть",
      hint: formatHotkey(hotkeyFor("closeTab").keys),
      separatorBefore: true,
      onSelect: () => void closePromptFileTab(file.id),
    });
  }
  items.push({
    label: "Закрыть остальные вкладки",
    separatorBefore: place === "sidebar",
    onSelect: () => void closeOtherTabs(file.id),
  });
  items.push({
    label: "Удалить",
    danger: true,
    separatorBefore: true,
    onSelect: async () => {
      try {
        const undo = await deletePromptFileWithUndo(file.id);
        if (undo) notifyUndo(`Файл «${file.name}» удалён`, undo);
      } catch (error) {
        notifyError(getErrorMessage(error, "Не удалось удалить файл"));
      }
    },
  });
  return items;
}
