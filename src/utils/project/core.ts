/**
 * Общие помощники действий над проектом: запись в базу, обновление проекта, сброс сторов.
 * Часть projectActions (этап 15.1); снаружи импортируется через него.
 */
import { get } from "svelte/store";
import type { Project } from "../../types";
import {
  activeProject,
  openFileIds,
  previewFileId,
  activeFileId,
  selectedFileIds,
  selectedProjectFiles,
  previewFileFromTree,
  editorHtml,
  pendingSaveController,
} from "../../stores";
import {
  saveProject,
  SAVE_META,
  loadProject,
  calculateProjectSize,
  type ProjectSaveChanges,
} from "../projectDb";
import { rememberLastProject } from "../lastProject";
import { logError } from "$lib/log";

// ════════════════════════════════════════════
// Общие помощники
// ════════════════════════════════════════════

export async function flushPendingEditorSave(): Promise<void> {
  const controller = get(pendingSaveController);
  if (!controller) return;
  try {
    await controller.flush();
  } catch (error) {
    logError("Failed to flush pending editor save", error);
  }
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function megabytes(bytes: number, digits = 0): string {
  return (bytes / 1024 / 1024).toFixed(digits);
}

/** Кладёт проект в стор и пишет в базу указанные части. */
export async function commitProject(
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
export async function updateProject(
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
export async function updateProjectById(
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
export function insertAt<T>(items: T[], index: number, item: T): T[] {
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
export function resetTreeSelection(): void {
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
