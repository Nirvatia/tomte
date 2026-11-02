import { derived, readable, writable, type Readable } from "svelte/store";

import type { AttachedFile, ExportFormat, Project, PromptFile } from "../types";
import type { TreeNode } from "../utils/projectTree";
import { buildTreeString } from "../utils/treeText";

/**
 * Как derived, но оповещает подписчиков, только когда выбранное значение
 * сменилось по ссылке. Обычный derived считает любые объекты изменёнными,
 * а activeProject обновляется на каждое автосохранение: без этого дерево
 * и вложения пересчитывались бы при каждом нажатии клавиши.
 */
const UNSET = Symbol("unset");

function select<T, R>(source: Readable<T>, pick: (value: T) => R): Readable<R> {
  // Начальное значение не важно: start вызывается до того, как подписчик его получит.
  return readable(undefined as R, (set) => {
    let last: R | typeof UNSET = UNSET;
    return source.subscribe((value) => {
      const next = pick(value);
      if (next !== last) {
        last = next;
        set(next);
      }
    });
  });
}

const EMPTY_FILES: PromptFile[] = [];
const EMPTY_ATTACHMENTS: AttachedFile[] = [];
const EMPTY_NODES: TreeNode[] = [];

// ═══ Проект ═══

/** Единственный источник данных проекта. Всё ниже про проект выводится из него. */
export const activeProject = writable<Project | null>(null);

export const promptFiles = select(
  activeProject,
  ($project) => $project?.files ?? EMPTY_FILES,
);

export const attachedFiles = select(
  activeProject,
  ($project) => $project?.attachments ?? EMPTY_ATTACHMENTS,
);

const projectTreeSource = select(
  activeProject,
  ($project) => $project?.projectTreeSource ?? null,
);

export const projectTreeNodes = derived(
  projectTreeSource,
  ($source) => $source?.nodes ?? EMPTY_NODES,
);

export const projectTreeRootName = derived(
  projectTreeSource,
  ($source) => $source?.rootName ?? "",
);

export const projectTreeString = derived(projectTreeSource, ($source) =>
  $source ? buildTreeString($source.rootName, $source.nodes) : "",
);

// ═══ Вкладки и активный файл ═══

export const activeFileId = writable<string | null>(null);
export const openFileIds = writable<string[]>([]);
export const previewFileId = writable<string | null>(null);

export const activeFile = derived(
  [activeProject, activeFileId],
  ([$project, $fileId]) => {
    if (!$project || !$fileId) return null;
    return $project.files.find((f) => f.id === $fileId) ?? null;
  },
);

/** HTML активного файла, как он сейчас в редакторе (в том числе ещё не сохранённый). */
export const editorHtml = writable<string>("");

/** Отложенное сохранение редактора: действия вызывают flush перед изменением проекта. */
export const pendingSaveController = writable<{
  flush: () => Promise<void>;
} | null>(null);

// ═══ Выбор для экспорта ═══

/** id вложений, отмеченных для экспорта. */
export const selectedFileIds = writable<Set<string>>(new Set());
/** Пути файлов дерева, отмеченных для экспорта. */
export const selectedProjectFiles = writable<string[]>([]);
/** Файл дерева, открытый в превью. */
export const previewFileFromTree = writable<AttachedFile | null>(null);

export const totalFilesCount = derived(
  attachedFiles,
  ($files) => $files.length,
);
export const selectedFilesCount = derived(
  [attachedFiles, selectedFileIds],
  ([$files, $selectedIds]) =>
    $files.filter((f) => $selectedIds.has(f.id)).length,
);

export const exportFormat = writable<ExportFormat>("pdf");

// ═══ Модалки и панели ═══

export const isPreviewOpen = writable<boolean>(false);
export const isExtractorOpen = writable<boolean>(false);
export const isFileManagerOpen = writable<boolean>(false);
export const isProjectTreeOpen = writable<boolean>(false);
export const isProjectManagerOpen = writable<boolean>(false);
export const isTagManagerOpen = writable<boolean>(false);
export const isCodeMapOpen = writable<boolean>(false);

// ═══ Теги ═══

/** Счётчик изменений тегов: теги лежат в localStorage, панели перечитывают их по смене версии. */
export const tagsVersion = writable<number>(0);
