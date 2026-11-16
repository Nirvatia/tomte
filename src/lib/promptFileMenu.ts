import { get } from "svelte/store";

import { translate } from "./i18n";

import type { PromptFile } from "../types";
import type { ContextMenuItem } from "../stores/contextMenu";
import { activeProject, historyFileId, openFileIds } from "../stores";
import { requestConfirm } from "../stores/confirm";
import {
  closeOtherTabs,
  closePromptFileTab,
  deletePromptFileWithUndo,
  duplicatePromptFile,
  flushPendingEditorSave,
  isEmptyContent,
  pinPromptFile,
  previewPromptFile,
} from "../utils/projectActions";
import { getErrorMessage } from "../utils";
import { formatHotkey, hotkeyFor } from "./hotkeys";
import { notifyError, notifyUndo } from "./notify";

/** Длина текста промпта без разметки. */
function textLength(html: string): number {
  const doc = new DOMParser().parseFromString(html, "text/html");
  return (doc.body.textContent ?? "").trim().length;
}

/**
 * Удаление одного файла промпта: кнопка в панели и пункт контекстного меню.
 * Промпт — главное, что делается в приложении, поэтому файл с текстом
 * удаляется только после подтверждения. Отмена в уведомлении остаётся
 * второй страховкой. Пустой файл удаляется без вопроса: терять в нём нечего.
 */
export async function deletePromptFileConfirmed(
  listed: PromptFile,
): Promise<boolean> {
  // Текст, набранный только что, ещё ждёт отложенного сохранения: без
  // сброса файл казался бы пустым и удалился бы без вопроса.
  await flushPendingEditorSave();
  const file =
    get(activeProject)?.files.find((f) => f.id === listed.id) ?? listed;

  if (!isEmptyContent(file.content)) {
    const isLast = (get(activeProject)?.files.length ?? 0) <= 1;
    const chars = translate("common.chars", {
      count: textLength(file.content),
    });
    const confirmed = await requestConfirm({
      title: translate("prompts.deleteOne.title"),
      message:
        translate("prompts.deleteOne.message", { name: file.name, chars }) +
        (isLast ? "\n\n" + translate("prompts.deleteMany.lastNote") : ""),
      confirmText: translate("common.delete"),
      cancelText: translate("common.cancel"),
      danger: true,
    });
    if (!confirmed) return false;
  }

  try {
    const undo = await deletePromptFileWithUndo(file.id);
    if (undo) {
      notifyUndo(translate("prompts.deleted", { name: file.name }), undo);
    }
    return Boolean(undo);
  } catch (error) {
    notifyError(getErrorMessage(error, translate("prompts.errors.delete")));
    return false;
  }
}

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
      label: translate("history.open"),
      onSelect: () => historyFileId.set(file.id),
    },
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
    onSelect: () => void deletePromptFileConfirmed(file),
  });
  return items;
}
