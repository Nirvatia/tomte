import { translate } from "$lib/i18n";
import { get } from "svelte/store";

import type {
  AttachedFile,
  Project,
  ProjectTreeSource,
  PromptFile,
} from "../types";
import { PROJECT_SIZE_LIMIT } from "../types";
import type { TreeNode } from "./projectTree";
import type { GithubRepoConfig } from "./github";

import {
  activeProject,
  projectTreeNodes,
  openFileIds,
  previewFileId,
  activeFileId,
  selectedFileIds,
  selectedProjectFiles,
  previewFileFromTree,
  editorHtml,
  pendingSaveController,
} from "../stores";
import { requestConfirm } from "../stores/confirm";

import {
  saveProject,
  SAVE_META,
  checkProjectSize,
  loadProject,
  deleteProject,
  loadProjectSummaries,
  createEmptyProject,
  calculateProjectSize,
  type ProjectSaveChanges,
} from "./projectDb";
import { calculateStats, getTreeGithubConfig } from "./projectTree";
import { fetchGithubTree, resolveGithubToken } from "./github";
import { rememberLastProject } from "./lastProject";
import { moveId, type DropPlace } from "../lib/actions/reorder";

// ════════════════════════════════════════════
// Общие помощники
// ════════════════════════════════════════════

export async function flushPendingEditorSave(): Promise<void> {
  const controller = get(pendingSaveController);
  if (!controller) return;
  try {
    await controller.flush();
  } catch (error) {
    console.error("Failed to flush pending editor save:", error);
  }
}

function nowIso(): string {
  return new Date().toISOString();
}

function megabytes(bytes: number, digits = 0): string {
  return (bytes / 1024 / 1024).toFixed(digits);
}

/** Кладёт проект в стор и пишет в базу указанные части. */
async function commitProject(
  project: Project,
  changes: ProjectSaveChanges,
): Promise<void> {
  activeProject.set(project);
  await saveProject(project, changes);
}

/**
 * Меняет активный проект: дожидается сохранения текста, применяет mutate,
 * обновляет updatedAt и размер, кладёт в стор и сохраняет.
 * Если проекта нет или mutate вернул null, ничего не делает и возвращает null.
 */
async function updateProject(
  mutate: (project: Project) => Project | null,
  changes: ProjectSaveChanges = SAVE_META,
): Promise<Project | null> {
  await flushPendingEditorSave();
  const project = get(activeProject);
  if (!project) return null;

  const next = mutate(project);
  if (!next) return null;

  const updated: Project = { ...next, updatedAt: nowIso() };
  updated.totalSize = calculateProjectSize(updated);
  await commitProject(updated, changes);
  return updated;
}

/**
 * Меняет проект по id: активный — как обычно, другой (пользователь успел
 * переключиться) — читает из базы, меняет и сохраняет, не трогая сторы.
 * Возвращает true, если проект был активным.
 */
async function updateProjectById(
  projectId: string,
  mutate: (project: Project) => Project | null,
  changes: ProjectSaveChanges = SAVE_META,
): Promise<boolean> {
  if (get(activeProject)?.id === projectId) {
    await updateProject(mutate, changes);
    return true;
  }
  const stored = await loadProject(projectId);
  const next = stored && mutate(stored);
  if (!next) return false;
  const updated: Project = { ...next, updatedAt: nowIso() };
  updated.totalSize = calculateProjectSize(updated);
  await saveProject(updated, changes);
  return false;
}

/** Вставляет элемент на прежнее место (или в конец, если список стал короче). */
function insertAt<T>(items: T[], index: number, item: T): T[] {
  const next = [...items];
  next.splice(Math.min(Math.max(index, 0), next.length), 0, item);
  return next;
}

function resetProjectScopedStores(): void {
  selectedFileIds.set(new Set());
  selectedProjectFiles.set([]);
  previewFileFromTree.set(null);
  editorHtml.set("");
}

/** Сбрасывает то, что выбрано в дереве: после замены дерева пути могли устареть. */
function resetTreeSelection(): void {
  selectedProjectFiles.set([]);
  previewFileFromTree.set(null);
}

export function applyProjectToStores(project: Project): void {
  previewFileId.set(null);
  activeFileId.set(null);
  openFileIds.set([]);
  resetProjectScopedStores();
  activeProject.set(project);
  rememberLastProject(project.id);

  if (project.files.length > 0) {
    openFileIds.set([project.files[0].id]);
    activeFileId.set(project.files[0].id);
  }
}

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

function isEmptyContent(html: string): boolean {
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

  const confirmed = await requestConfirm({
    title: translate("limits.title"),
    message: translate("limits.attachmentsMessage", {
      size: megabytes(sizeCheck.size, 1),
      limit: megabytes(liteSizeCheck.limit),
    }),
    confirmText: translate("limits.addAsMetadata"),
    cancelText: translate("common.cancel"),
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

// ════════════════════════════════════════════
// Дерево проекта
// ════════════════════════════════════════════

/**
 * Читает содержимое файлов дерева, чтобы сохранить его в базе.
 * Если суммарно не влезает в budgetBytes, возвращает null:
 * тогда дерево сохраняется без содержимого.
 */
async function materializeFiles(
  nodes: TreeNode[],
  budgetBytes: number,
): Promise<TreeNode[] | null> {
  let totalBytes = 0;

  async function walk(items: TreeNode[]): Promise<TreeNode[] | null> {
    const result: TreeNode[] = [];
    for (const item of items) {
      if (item.type === "directory") {
        const children = await walk(item.children);
        if (!children) return null;
        result.push({ ...item, children });
        continue;
      }

      let file = item.fileRef;
      if (file && !(file instanceof File)) {
        try {
          file = await (file as FileSystemFileHandle).getFile();
        } catch {
          file = undefined;
        }
      }

      if (file instanceof File) {
        totalBytes += file.size;
        if (totalBytes > budgetBytes) return null;
      }
      result.push({ ...item, fileRef: file });
    }
    return result;
  }

  return walk(nodes);
}

function stripFileRefs(nodes: TreeNode[]): TreeNode[] {
  return nodes.map((node) =>
    node.type === "directory"
      ? { ...node, children: stripFileRefs(node.children) }
      : { ...node, fileRef: undefined },
  );
}

export async function setProjectTreeSource(
  source: ProjectTreeSource,
): Promise<boolean> {
  await flushPendingEditorSave();
  const project = get(activeProject);
  if (!project) return false;

  // Бюджет на содержимое дерева: что осталось от лимита проекта без старого дерева.
  const sizeWithoutTree = calculateProjectSize({
    ...project,
    projectTreeSource: undefined,
  });
  const materializedNodes = await materializeFiles(
    source.nodes,
    PROJECT_SIZE_LIMIT - sizeWithoutTree,
  );

  const withTree = (nodes: TreeNode[]): Project => ({
    ...project,
    projectTreeSource: {
      rootName: source.rootName,
      nodes,
      fileCount: source.fileCount,
    },
    updatedAt: nowIso(),
  });

  let updated = withTree(materializedNodes ?? stripFileRefs(source.nodes));
  let sizeCheck = checkProjectSize(updated);

  if (!sizeCheck.ok) {
    const confirmed = await requestConfirm({
      title: translate("limits.title"),
      message: translate("limits.treeMessage", {
        limit: megabytes(sizeCheck.limit),
      }),
      confirmText: translate("limits.saveStructure"),
      cancelText: translate("common.cancel"),
    });
    if (!confirmed) return false;

    updated = withTree(stripFileRefs(updated.projectTreeSource!.nodes));
    sizeCheck = checkProjectSize(updated);
    if (!sizeCheck.ok) {
      throw new Error(translate("limits.treeTooBig"));
    }
  }

  updated.totalSize = sizeCheck.size;
  await commitProject(updated, { tree: true });
  resetTreeSelection();
  return true;
}

export async function clearProjectTreeSource(): Promise<void> {
  const updated = await updateProject(
    (project) => ({ ...project, projectTreeSource: undefined }),
    { tree: true },
  );
  if (updated) resetTreeSelection();
}

export async function restoreGithubTree(): Promise<boolean> {
  const project = get(activeProject);
  if (!project?.githubConfig) return false;

  const nodes = await fetchGithubTree(project.githubConfig);
  return setProjectTreeSource({
    rootName: project.githubConfig.repo,
    nodes,
    fileCount: calculateStats(nodes).totalFiles,
  });
}

/**
 * Обновляет дерево проекта, перечитывая его из GitHub.
 * Работает только если текущее дерево построено из GitHub
 * (определяется по githubRef в узлах, а не по проекту в целом) —
 * локальное дерево никогда не будет перезаписано.
 * Возвращает false, если обновлять нечего.
 */
export async function refreshProjectTree(): Promise<boolean> {
  await flushPendingEditorSave();
  if (!get(activeProject)) return false;

  const config = getTreeGithubConfig(get(projectTreeNodes));
  if (!config) return false; // дерево не из GitHub — обновлять нечего

  const freshNodes = await fetchGithubTree({
    ...config,
    token: resolveGithubToken(config),
  });
  await setProjectTreeSource({
    rootName: config.repo,
    nodes: freshNodes,
    fileCount: calculateStats(freshNodes).totalFiles,
  });
  return true;
}

export async function setGithubConfig(config: GithubRepoConfig): Promise<void> {
  await updateProject((project) => ({ ...project, githubConfig: config }));
}

export async function clearGithubConfig(): Promise<void> {
  await updateProject((project) => ({ ...project, githubConfig: undefined }));
}

// ════════════════════════════════════════════
// Проекты
// ════════════════════════════════════════════

export async function switchProject(projectId: string): Promise<void> {
  await flushPendingEditorSave();
  const project = await loadProject(projectId);
  if (!project) return;
  applyProjectToStores(project);
}

export async function createNewProject(name?: string): Promise<void> {
  await flushPendingEditorSave();
  const newProject = createEmptyProject(
    name?.trim() || translate("projects.untitled"),
  );
  await saveProject(newProject);
  applyProjectToStores(newProject);
}

export async function renameProjectById(
  projectId: string,
  newName: string,
): Promise<void> {
  const trimmedName = newName.trim();
  if (!trimmedName) return;

  await flushPendingEditorSave();
  const current = get(activeProject);
  const isActive = current?.id === projectId;
  const project = isActive ? current : await loadProject(projectId);
  if (!project) return;

  const updated: Project = {
    ...project,
    name: trimmedName,
    updatedAt: nowIso(),
  };
  updated.totalSize = calculateProjectSize(updated);
  await saveProject(updated, SAVE_META);

  if (isActive) {
    activeProject.set(updated);
  }
}

export async function deleteProjectById(projectId: string): Promise<boolean> {
  await flushPendingEditorSave();
  const allProjects = await loadProjectSummaries();
  if (allProjects.length <= 1) return false;

  await deleteProject(projectId);

  if (get(activeProject)?.id === projectId) {
    const [latest] = await loadProjectSummaries();
    if (latest) {
      await switchProject(latest.id);
    } else {
      const fallback = createEmptyProject();
      await saveProject(fallback);
      applyProjectToStores(fallback);
    }
  }
  return true;
}

/**
 * Настройки GitHub для копии проекта. Токен — секрет, поэтому без спроса
 * его не размножаем: копия без токена работает с публичными репозиториями,
 * для приватного токен можно ввести заново.
 */
async function copyGithubConfig(
  config: GithubRepoConfig | undefined,
): Promise<GithubRepoConfig | undefined> {
  if (!config) return undefined;
  const { token, ...rest } = config;
  if (!token) return { ...rest };

  const copyToken = await requestConfirm({
    title: translate("projects.copyToken.title"),
    message: translate("projects.copyToken.message", {
      repo: `${config.owner}/${config.repo}`,
    }),
    confirmText: translate("projects.copyToken.confirm"),
    cancelText: translate("projects.copyToken.cancel"),
  });
  return copyToken ? { ...rest, token } : { ...rest };
}

export async function duplicateProjectById(projectId: string): Promise<void> {
  await flushPendingEditorSave();
  const current = get(activeProject);
  const source =
    current?.id === projectId ? current : await loadProject(projectId);
  if (!source) return;

  const now = nowIso();
  const newProject: Project = {
    ...source,
    id: crypto.randomUUID(),
    name: translate("projects.copySuffix", { name: source.name }),
    files: source.files.map((f) => ({
      ...f,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    })),
    attachments: source.attachments.map((a) => ({
      ...a,
      id: crypto.randomUUID(),
    })),
    projectTreeSource: source.projectTreeSource
      ? { ...source.projectTreeSource }
      : undefined,
    githubConfig: await copyGithubConfig(source.githubConfig),
    createdAt: now,
    updatedAt: now,
    totalSize: 0,
  };

  const sizeCheck = checkProjectSize(newProject);
  if (!sizeCheck.ok) {
    throw new Error(translate("limits.copyTooBig"));
  }

  newProject.totalSize = sizeCheck.size;
  await saveProject(newProject);
}
