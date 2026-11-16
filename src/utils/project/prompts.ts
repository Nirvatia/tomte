/**
 * Файлы промптов и вкладки.
 * Часть projectActions (этап 15.1); снаружи импортируется через него.
 */
import { translate } from "$lib/i18n";
import { get } from "svelte/store";
import type { Project, PromptFile } from "../../types";
import {
  activeProject,
  openFileIds,
  previewFileId,
  activeFileId,
} from "../../stores";
import { moveId, type DropPlace } from "../../lib/actions/reorder";
import {
  flushPendingEditorSave,
  insertAt,
  nowIso,
  updateProject,
  updateProjectById,
} from "./core";

// ════════════════════════════════════════════
// Файлы промптов и вкладки
// ════════════════════════════════════════════

/**
 * Номер последнего запроса на переключение файла.
 * Каждое переключение сначала ждёт сохранения текста; если за это время
 * пользователь кликнул по другому файлу, старый запрос не должен его перебить.
 */
let navigationSeq = 0;

async function navigate(apply: () => void): Promise<void> {
  const seq = ++navigationSeq;
  await flushPendingEditorSave();
  if (seq !== navigationSeq) return;
  apply();
}

function hasFile(fileId: string): boolean {
  return Boolean(get(activeProject)?.files.some((f) => f.id === fileId));
}

function createPromptFileObject(name: string, content = ""): PromptFile {
  const now = nowIso();
  return {
    id: crypto.randomUUID(),
    name,
    content,
    createdAt: now,
    updatedAt: now,
  };
}

function getUniquePromptFileName(project: Project, desired?: string): string {
  const names = new Set(project.files.map((f) => f.name.toLowerCase()));
  const isFree = (candidate: string) => !names.has(candidate.toLowerCase());

  const base = desired?.trim();
  if (base) {
    if (isFree(base)) return base;
    const dotIndex = base.lastIndexOf(".");
    const stem = dotIndex > 0 ? base.slice(0, dotIndex) : base;
    const ext = dotIndex > 0 ? base.slice(dotIndex) : "";
    let counter = 2;
    while (!isFree(`${stem} (${counter})${ext}`)) counter += 1;
    return `${stem} (${counter})${ext}`;
  }

  let counter = 1;
  while (!isFree(`prompt-${counter}`)) counter += 1;
  return `prompt-${counter}`;
}

export async function createPromptFile(name?: string): Promise<string | null> {
  const created = { file: null as PromptFile | null };

  await updateProject((project) => {
    created.file = createPromptFileObject(
      getUniquePromptFileName(project, name),
    );
    return { ...project, files: [...project.files, created.file] };
  });
  if (!created.file) return null;

  const id = created.file.id;
  openFileIds.update((ids) => (ids.includes(id) ? ids : [...ids, id]));
  previewFileId.set(null);
  activeFileId.set(id);
  return id;
}

export async function renamePromptFile(
  fileId: string,
  newName: string,
): Promise<boolean> {
  const trimmedName = newName.trim();
  if (!fileId || !trimmedName) return false;

  let found = false;
  await updateProject((project) => {
    const file = project.files.find((f) => f.id === fileId);
    if (!file) return null;
    found = true;
    if (file.name === trimmedName) return null; // нечего менять

    const now = nowIso();
    return {
      ...project,
      files: project.files.map((f) =>
        f.id === fileId ? { ...f, name: trimmedName, updatedAt: now } : f,
      ),
    };
  });
  return found;
}

/** Какой файл сделать активным после закрытия/удаления fileId. */
function pickNextActiveId(
  closedId: string,
  oldOpenIds: string[],
  nextOpenIds: string[],
): string | null {
  if (nextOpenIds.length === 0) return null;
  const closedIndex = oldOpenIds.indexOf(closedId);
  const safeIndex = Math.min(Math.max(closedIndex, 0), nextOpenIds.length - 1);
  return nextOpenIds[safeIndex];
}

export async function deletePromptFile(fileId: string): Promise<boolean> {
  if (!fileId) return false;
  return deletePromptFiles([fileId]);
}

/**
 * Удаляет несколько файлов промптов за одно сохранение.
 * Если удалены все, создаёт пустой main: проект не остаётся без файлов.
 * Вкладки и активный файл поправляет так же, как при закрытии вкладки.
 */
export async function deletePromptFiles(fileIds: string[]): Promise<boolean> {
  const ids = new Set(fileIds);
  if (ids.size === 0) return false;

  const created = { file: null as PromptFile | null };
  const updated = await updateProject((project) => {
    if (!project.files.some((f) => ids.has(f.id))) return null;

    let files = project.files.filter((f) => !ids.has(f.id));
    if (files.length === 0) {
      created.file = createPromptFileObject("main");
      files = [created.file];
    }
    return { ...project, files };
  });
  if (!updated) return false;

  if (created.file) {
    openFileIds.set([created.file.id]);
    previewFileId.set(null);
    activeFileId.set(created.file.id);
    return true;
  }

  const files = updated.files;
  const exists = (id: string | null): id is string =>
    id !== null && files.some((f) => f.id === id);

  const oldOpenIds = get(openFileIds);
  const oldActiveId = get(activeFileId);
  const oldPreviewId = get(previewFileId);
  const nextOpenIds = oldOpenIds.filter(exists);
  const nextPreviewId = exists(oldPreviewId) ? oldPreviewId : null;

  let nextActiveId = oldActiveId;
  if (!exists(nextActiveId)) {
    nextActiveId =
      (oldActiveId && pickNextActiveId(oldActiveId, oldOpenIds, nextOpenIds)) ??
      nextPreviewId ??
      files[0]?.id ??
      null;
  }

  openFileIds.set(nextOpenIds);
  previewFileId.set(nextPreviewId);
  activeFileId.set(nextActiveId);

  if (nextActiveId && !nextOpenIds.includes(nextActiveId)) {
    previewFileId.set(nextActiveId);
  }
  return true;
}

export function isEmptyContent(html: string): boolean {
  return html.replace(/<p><\/p>/g, "").trim() === "";
}

/**
 * Удаляет файл промпта и возвращает функцию отмены (null, если удалять нечего).
 * Отмена возвращает файл на прежнее место, вкладку и активность; пустой main,
 * созданный вместо последнего файла, убирает.
 */
export async function deletePromptFileWithUndo(
  fileId: string,
): Promise<(() => Promise<void>) | null> {
  await flushPendingEditorSave();
  const project = get(activeProject);
  const index = project?.files.findIndex((f) => f.id === fileId) ?? -1;
  if (!project || index < 0) return null;

  const file = project.files[index];
  const tabIndex = get(openFileIds).indexOf(fileId);
  const wasActive = get(activeFileId) === fileId;
  const idsBefore = new Set(project.files.map((f) => f.id));

  if (!(await deletePromptFiles([fileId]))) return null;
  const placeholder = get(activeProject)?.files.find(
    (f) => !idsBefore.has(f.id),
  );

  return async () => {
    const isActive = await updateProjectById(project.id, (current) => {
      if (current.files.some((f) => f.id === file.id)) return null;
      const files = current.files.filter(
        (f) =>
          !(
            placeholder &&
            f.id === placeholder.id &&
            isEmptyContent(f.content)
          ),
      );
      return { ...current, files: insertAt(files, index, file) };
    });
    if (!isActive) return;

    const files = get(activeProject)?.files ?? [];
    openFileIds.update((ids) => {
      const kept = ids.filter((id) => files.some((f) => f.id === id));
      return tabIndex >= 0 && !kept.includes(file.id)
        ? insertAt(kept, tabIndex, file.id)
        : kept;
    });
    if (wasActive || !files.some((f) => f.id === get(activeFileId))) {
      if (!get(openFileIds).includes(file.id)) previewFileId.set(file.id);
      activeFileId.set(file.id);
    }
  };
}

export async function activatePromptFile(fileId: string): Promise<void> {
  await navigate(() => {
    if (!hasFile(fileId)) return;
    activeFileId.set(fileId);
  });
}

export async function previewPromptFile(fileId: string): Promise<void> {
  await navigate(() => {
    if (!hasFile(fileId)) return;
    if (!get(openFileIds).includes(fileId)) {
      previewFileId.set(fileId);
    }
    activeFileId.set(fileId);
  });
}

export async function pinPromptFile(fileId: string): Promise<void> {
  await navigate(() => {
    if (!hasFile(fileId)) return;
    openFileIds.update((ids) =>
      ids.includes(fileId) ? ids : [...ids, fileId],
    );
    previewFileId.set(null);
    activeFileId.set(fileId);
  });
}

/**
 * Копия файла промпта рядом с оригиналом: «имя (копия)», открывается
 * во вкладке справа от оригинала и становится активной.
 */
export async function duplicatePromptFile(
  fileId: string,
): Promise<string | null> {
  const created = { file: null as PromptFile | null };
  await updateProject((project) => {
    const index = project.files.findIndex((f) => f.id === fileId);
    if (index < 0) return null;
    const source = project.files[index];
    created.file = createPromptFileObject(
      getUniquePromptFileName(
        project,
        translate("projects.copySuffix", { name: source.name }),
      ),
      source.content,
    );
    return {
      ...project,
      files: insertAt(project.files, index + 1, created.file),
    };
  });
  if (!created.file) return null;

  const id = created.file.id;
  openFileIds.update((ids) => {
    const at = ids.indexOf(fileId);
    return at >= 0 ? insertAt(ids, at + 1, id) : [...ids, id];
  });
  previewFileId.set(null);
  activeFileId.set(id);
  return id;
}

/** Оставляет открытой только вкладку fileId (она же становится активной). */
export async function closeOtherTabs(fileId: string): Promise<void> {
  await flushPendingEditorSave();
  if (!hasFile(fileId)) return;
  openFileIds.set([fileId]);
  previewFileId.set(null);
  activeFileId.set(fileId);
}

/**
 * Переносит файл промпта в панели. Порядок хранится в проекте
 * (и задаёт порядок файлов в ZIP), вкладки не трогает.
 */
export async function movePromptFile(
  draggedId: string,
  targetId: string,
  place: DropPlace,
): Promise<void> {
  await updateProject((project) => {
    const ids = moveId(
      project.files.map((f) => f.id),
      draggedId,
      targetId,
      place,
    );
    if (ids.every((id, i) => id === project.files[i]?.id)) {
      return null;
    }
    const byId = new Map(project.files.map((f) => [f.id, f]));
    return { ...project, files: ids.map((id) => byId.get(id)!) };
  });
}

/** Сдвигает файл в панели на одну позицию (Alt+↑/↓). */
export async function movePromptFileBy(
  fileId: string,
  step: 1 | -1,
): Promise<void> {
  const files = get(activeProject)?.files ?? [];
  const index = files.findIndex((f) => f.id === fileId);
  const target = files[index + step];
  if (index < 0 || !target) return;
  await movePromptFile(fileId, target.id, step === 1 ? "after" : "before");
}

/**
 * Переносит вкладку. Порядок вкладок — только для текущей сессии.
 * Перетащенная вкладка предпросмотра закрепляется, как в VS Code.
 */
export function moveTab(
  draggedId: string,
  targetId: string,
  place: DropPlace,
): void {
  const next = moveId(getVisibleTabIds(), draggedId, targetId, place);
  openFileIds.set(next);
  if (next.includes(get(previewFileId) ?? "")) previewFileId.set(null);
}

/** Сдвигает вкладку на одну позицию (Alt+←/→). */
export function moveTabBy(fileId: string, step: 1 | -1): void {
  const tabs = getVisibleTabIds();
  const target = tabs[tabs.indexOf(fileId) + step];
  if (!tabs.includes(fileId) || !target) return;
  moveTab(fileId, target, step === 1 ? "after" : "before");
}

/** Вкладки в том порядке, в каком их видно: закреплённые, затем предпросмотр. */
export function getVisibleTabIds(): string[] {
  const files = get(activeProject)?.files ?? [];
  const exists = (id: string) => files.some((f) => f.id === id);
  const open = get(openFileIds).filter(exists);
  const preview = get(previewFileId);
  return preview && exists(preview) && !open.includes(preview)
    ? [...open, preview]
    : open;
}

/** Переключает на соседнюю вкладку по кругу (step: 1 — вправо, -1 — влево). */
export async function activateAdjacentTab(step: 1 | -1): Promise<void> {
  const tabs = getVisibleTabIds();
  if (tabs.length < 2) return;
  const current = tabs.indexOf(get(activeFileId) ?? "");
  const next = tabs[(current + step + tabs.length) % tabs.length];
  await activatePromptFile(next);
}

export async function closePromptFileTab(fileId: string): Promise<void> {
  await flushPendingEditorSave();
  const project = get(activeProject);
  if (!project) return;

  const openIds = get(openFileIds);
  const previewId = get(previewFileId);
  const activeId = get(activeFileId);
  const isPreviewTab = previewId === fileId && !openIds.includes(fileId);

  if (isPreviewTab) {
    previewFileId.set(null);
    if (activeId === fileId) {
      activeFileId.set(openIds.length > 0 ? openIds[openIds.length - 1] : null);
    }
    return;
  }

  const remainingOpenIds = openIds.filter((id) => id !== fileId);
  openFileIds.set(remainingOpenIds);

  if (activeId !== fileId) return;

  const previewExists =
    previewId !== null && project.files.some((f) => f.id === previewId);
  activeFileId.set(
    pickNextActiveId(fileId, openIds, remainingOpenIds) ??
      (previewExists ? previewId : null),
  );
}

export async function clearActiveFileContent(): Promise<void> {
  const fileId = get(activeFileId);
  if (!fileId) return;

  await updateProject((project) => {
    const now = nowIso();
    return {
      ...project,
      files: project.files.map((f) =>
        f.id === fileId ? { ...f, content: "", updatedAt: now } : f,
      ),
    };
  });
}
