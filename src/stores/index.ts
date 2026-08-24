import { writable, derived } from "svelte/store";
import type { AttachedFile, ExportFormat, Project, PromptFile } from "../types";
import type { TreeNode } from "../utils/projectTree";

// ═══ Legacy stores ═══
export const selectedProjectFiles = writable<string[]>([]);
export const fileName = writable<string>("prompt");
export const exportFormat = writable<ExportFormat>("pdf");
export const editorHtml = writable<string>("");
export const isPreviewOpen = writable<boolean>(false);
export const isExtractorOpen = writable<boolean>(false);
export const isFileManagerOpen = writable<boolean>(false);
export const isProjectTreeOpen = writable<boolean>(false);
export const selectedFileIds = writable<Set<string>>(new Set());
export const projectTreeNodes = writable<TreeNode[]>([]);
export const projectTreeRootName = writable<string>("");
export const projectTreeString = writable<string>("");
export const previewFileFromTree = writable<AttachedFile | null>(null);

// ═══ IDE Project Module ═══
export const activeProject = writable<Project | null>(null);
export const promptFiles = derived(
  activeProject,
  ($project) => $project?.files ?? []
);
export const activeFileId = writable<string | null>(null);
export const activeFile = derived(
  [activeProject, activeFileId],
  ([$project, $fileId]) => {
    if (!$project || !$fileId) return null;
    return $project.files.find((f) => f.id === $fileId) ?? null;
  }
);
export const openFileIds = writable<string[]>([]);
export const previewFileId = writable<string | null>(null);

// ═══ НОВОЕ: Менеджер проектов ═══
export const isProjectManagerOpen = writable<boolean>(false);

// ═══ НОВОЕ: Менеджер тегов ═══
export const isTagManagerOpen = writable<boolean>(false);

// ═══ НОВОЕ: Триггер синхронизации тегов ═══
// Инкрементируется при каждом изменении тегов (добавление, удаление,
// редактирование, переключение избранного). Компоненты, подписанные
// на этот стор, автоматически перезагружают теги из localStorage.
export const tagsVersion = writable<number>(0);

// ═══ Вложения теперь в проекте ═══
// Запись только через хелперы из projectActions.ts
export const attachedFiles = derived(
  activeProject,
  ($project) => $project?.attachments ?? []
);

// Derived-счётчики работают автоматически, так как зависят от attachedFiles
export const totalFilesCount = derived(attachedFiles, ($files) => $files.length);
export const selectedFilesCount = derived(
  [attachedFiles, selectedFileIds],
  ([$files, $selectedIds]) => $files.filter((f) => $selectedIds.has(f.id)).length,
);

// ═══ Спринт 1: управление отложенным сохранением редактора ═══
// PromptEditor регистрирует здесь функцию, которая принудительно
// сохраняет несохранённый контент перед переключением проекта.
export const pendingSaveController = writable<{
  flush: () => Promise<void>;
} | null>(null);

// Ошибка сохранения проекта (пока можно использовать для статуса/логов)
export const projectSaveError = writable<string | null>(null);