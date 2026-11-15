/** docx-gost: DOCX с оформлением по ГОСТ 7.32-2017. */
export type ExportFormat = "md" | "pdf" | "docx" | "docx-gost" | "png";

export interface AttachedFile {
  id: string;
  name: string;
  size: number;
  /** binary: файл без содержимого (PDF, архив и т.п.), хранится только имя и размер. */
  type: "text" | "image" | "binary";
  content?: string;
  dataUrl?: string;
  ext?: string;
  width?: number;
  height?: number;
}

/**
 * Файл, уходящий в превью или экспорт.
 * label: метка плейсхолдера из редактора («IMAGE_2», «FILE_1»), посчитанная
 * по всем вложениям проекта, а не по отобранным. null — плейсхолдера нет
 * (например, файл из дерева проекта): файл подписывается только именем.
 * undefined — посчитать по списку, в котором файл передан.
 */
export interface ExportFile extends AttachedFile {
  label?: string | null;
}

export interface Tag {
  id: string;
  name: string;
  value: string;
  favorite?: boolean;
  createdAt?: string;
}

// ════════════════════════════════════════════
// IDE PROJECT MODULE
// ════════════════════════════════════════════

import type { TreeNode } from "../utils/projectTree";
import type { GithubRepoConfig } from "../utils/github";

/** Файл промпта (вкладка в редакторе) */
export interface PromptFile {
  id: string;
  name: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Снапшот файла промпта (этап 10.3). Живут в проекте по fileId,
 * старейшие вытесняются при превышении лимита.
 */
export interface PromptFileVersion {
  id: string;
  content: string;
  createdAt: string;
}

/** Сколько версий одного файла храним. */
export const MAX_FILE_VERSIONS = 20;

/**
 * Фильтры выбора файлов дерева (этап 10.6): .gitignore + пресеты + свои
 * правила. Отсеянные файлы приглушены в дереве и не попадают в выбор,
 * экспорт и подсчёт токенов.
 */
export interface TreeFilterSettings {
  useGitignore: boolean;
  presets: string[];
  /** Свои правила, по одному на строку. */
  custom: string[];
}

/** Фильтр по умолчанию: .gitignore учитываем, пресеты и правила пусты. */
export const DEFAULT_TREE_FILTER: TreeFilterSettings = {
  useGitignore: true,
  presets: [],
  custom: [],
};

/** Источник дерева проекта (локальная папка или GitHub) */
export interface ProjectTreeSource {
  rootName: string;
  nodes: TreeNode[];
  fileCount: number;
}

/** Проект IDE: набор файлов промптов + вложения + дерево проекта */
export interface Project {
  id: string;
  name: string;
  files: PromptFile[];
  attachments: AttachedFile[];
  projectTreeSource?: ProjectTreeSource;
  githubConfig?: GithubRepoConfig;
  /** Снапшоты файлов: fileId → версии, от старых к новым. */
  fileVersions?: Record<string, PromptFileVersion[]>;
  /** Фильтры выбора файлов дерева (этап 10.6). */
  treeFilter?: TreeFilterSettings;
  totalSize: number;
  createdAt: string;
  updatedAt: string;
}

/** Лимит размера проекта в IndexedDB (50 МБ) */
export const PROJECT_SIZE_LIMIT = 50 * 1024 * 1024;
