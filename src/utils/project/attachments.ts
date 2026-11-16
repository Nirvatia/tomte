/**
 * Вложения проекта.
 * Часть projectActions (этап 15.1); снаружи импортируется через него.
 */
import { translate } from "$lib/i18n";
import { get } from "svelte/store";
import type { AttachedFile, Project } from "../../types";
import { activeProject, selectedFileIds } from "../../stores";
import { decide } from "./decisions";
import { checkProjectSize } from "../projectDb";
import {
  commitProject,
  flushPendingEditorSave,
  insertAt,
  megabytes,
  nowIso,
  updateProject,
  updateProjectById,
} from "./core";

// ════════════════════════════════════════════
// Вложения
// ════════════════════════════════════════════

/** Вложение без содержимого: только имя, размер и тип. */
function toMetadataOnly(file: AttachedFile): AttachedFile {
  const { id, name, size, type, ext, width, height } = file;
  return { id, name, size, type, ext, width, height };
}

export async function addAttachmentsToProject(
  files: AttachedFile[],
): Promise<void> {
  await flushPendingEditorSave();
  const project = get(activeProject);
  if (!project || files.length === 0) return;

  const updatedAt = nowIso();
  const full: Project = {
    ...project,
    attachments: [...project.attachments, ...files],
    updatedAt,
  };

  const sizeCheck = checkProjectSize(full);
  if (sizeCheck.ok) {
    full.totalSize = sizeCheck.size;
    await commitProject(full, { attachments: { put: files } });
    return;
  }

  // Не влезает: предлагаем добавить новые файлы без содержимого.
  const liteNewFiles = files.map(toMetadataOnly);
  const lite: Project = {
    ...project,
    attachments: [...project.attachments, ...liteNewFiles],
    updatedAt,
  };
  const liteSizeCheck = checkProjectSize(lite);

  const confirmed = await decide().addAttachmentsAsMetadata({
    size: megabytes(sizeCheck.size, 1),
    limit: megabytes(liteSizeCheck.limit),
  });

  if (!confirmed) {
    throw new Error(translate("limits.notAdded"));
  }
  if (!liteSizeCheck.ok) {
    throw new Error(translate("limits.metadataTooBig"));
  }

  lite.totalSize = liteSizeCheck.size;
  await commitProject(lite, { attachments: { put: liteNewFiles } });
}

/** Удаляет вложения по id и снимает с них выбор. Возвращает, сколько удалено. */
async function removeAttachments(ids: Set<string>): Promise<number> {
  const result = { removed: 0 };
  await updateProject(
    (project) => {
      const attachments = project.attachments.filter((f) => !ids.has(f.id));
      result.removed = project.attachments.length - attachments.length;
      return { ...project, attachments };
    },
    { attachments: { delete: ids } },
  );

  selectedFileIds.update((current) => {
    const next = new Set(current);
    for (const id of ids) next.delete(id);
    return next;
  });
  return result.removed;
}

export async function removeAttachmentFromProject(
  fileId: string,
): Promise<void> {
  if (!get(activeProject)) return;
  await removeAttachments(new Set([fileId]));
}

/** Удаляет вложение и возвращает функцию отмены (null, если удалять нечего). */
export async function removeAttachmentWithUndo(
  fileId: string,
): Promise<(() => Promise<void>) | null> {
  const project = get(activeProject);
  const index = project?.attachments.findIndex((f) => f.id === fileId) ?? -1;
  if (!project || index < 0) return null;

  const file = project.attachments[index];
  const wasSelected = get(selectedFileIds).has(fileId);
  await removeAttachments(new Set([fileId]));

  return async () => {
    const isActive = await updateProjectById(
      project.id,
      (current) =>
        current.attachments.some((f) => f.id === file.id)
          ? null
          : {
              ...current,
              attachments: insertAt(current.attachments, index, file),
            },
      { attachments: { put: [file] } },
    );
    if (isActive && wasSelected) {
      selectedFileIds.update((ids) => new Set([...ids, file.id]));
    }
  };
}

export async function removeAttachmentsFromProject(
  fileIds: Set<string>,
): Promise<void> {
  if (!get(activeProject)) return;
  await removeAttachments(fileIds);
}

export async function removeSelectedAttachmentsFromProject(): Promise<number> {
  await flushPendingEditorSave();
  const project = get(activeProject);
  if (!project) return 0;

  const selected = get(selectedFileIds);
  const idsToDelete = new Set(
    project.attachments.filter((f) => selected.has(f.id)).map((f) => f.id),
  );

  if (idsToDelete.size === 0) {
    selectedFileIds.set(new Set());
    return 0;
  }
  return removeAttachments(idsToDelete);
}

export async function clearAttachmentsFromProject(): Promise<void> {
  const updated = await updateProject(
    (project) => ({ ...project, attachments: [] }),
    { attachments: "all" },
  );
  if (updated) selectedFileIds.set(new Set());
}

export function pruneSelectedFileIds(): void {
  const project = get(activeProject);
  if (!project) {
    selectedFileIds.set(new Set());
    return;
  }
  selectedFileIds.update((currentIds) => {
    const validIds = new Set(
      project.attachments
        .filter((file) => currentIds.has(file.id))
        .map((file) => file.id),
    );
    return validIds.size === currentIds.size ? currentIds : validIds;
  });
}
