/**
 * История версий файлов (этап 10.3).
 * Часть projectActions (этап 15.1); снаружи импортируется через него.
 */
import { get } from "svelte/store";
import { type PromptFileVersion, MAX_FILE_VERSIONS } from "../../types";
import { activeProject, activeFileId, contentRestore } from "../../stores";
import { flushPendingEditorSave, nowIso, updateProject } from "./core";

// ════════════════════════════════════════════
// История версий файлов (этап 10.3)
// ════════════════════════════════════════════

function pushVersion(
  list: PromptFileVersion[] | undefined,
  version: PromptFileVersion,
): PromptFileVersion[] {
  return [...(list ?? []), version].slice(-MAX_FILE_VERSIONS);
}

/** Снимок текущего содержимого файла (сначала догоняем автосохранение). */
export async function saveFileVersion(fileId: string): Promise<boolean> {
  await flushPendingEditorSave();
  const project = get(activeProject);
  const file = project?.files.find((f) => f.id === fileId);
  if (!project || !file) return false;

  const version: PromptFileVersion = {
    id: crypto.randomUUID(),
    content: file.content,
    createdAt: nowIso(),
  };
  await updateProject((project) => ({
    ...project,
    fileVersions: {
      ...(project.fileVersions ?? {}),
      [fileId]: pushVersion(project.fileVersions?.[fileId], version),
    },
  }));
  return true;
}

/**
 * Возвращает файлу содержимое версии. Текущий текст перед этим прячется
 * в новую версию — восстановление обратимо. Если файл активен, редактор
 * подхватывает новый текст через contentRestore (PromptEditor слушает).
 */
export async function restoreFileVersion(
  fileId: string,
  versionId: string,
): Promise<boolean> {
  await flushPendingEditorSave();
  const project = get(activeProject);
  const file = project?.files.find((f) => f.id === fileId);
  const version = project?.fileVersions?.[fileId]?.find(
    (v) => v.id === versionId,
  );
  if (!project || !file || !version) return false;

  const currentSnapshot: PromptFileVersion = {
    id: crypto.randomUUID(),
    content: file.content,
    createdAt: nowIso(),
  };
  await updateProject((project) => {
    const now = nowIso();
    return {
      ...project,
      files: project.files.map((f) =>
        f.id === fileId
          ? { ...f, content: version.content, updatedAt: now }
          : f,
      ),
      fileVersions: {
        ...(project.fileVersions ?? {}),
        [fileId]: pushVersion(project.fileVersions?.[fileId], currentSnapshot),
      },
    };
  });

  if (get(activeFileId) === fileId) {
    contentRestore.set({ fileId, html: version.content, nonce: Date.now() });
  }
  return true;
}

export async function deleteFileVersion(
  fileId: string,
  versionId: string,
): Promise<boolean> {
  const updated = await updateProject((project) => {
    const versions = project.fileVersions?.[fileId];
    if (!versions?.some((v) => v.id === versionId)) return null;
    return {
      ...project,
      fileVersions: {
        ...(project.fileVersions ?? {}),
        [fileId]: versions.filter((v) => v.id !== versionId),
      },
    };
  });
  return updated !== null;
}
