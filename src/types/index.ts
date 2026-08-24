export type ExportFormat = "md" | "pdf" | "docx" | "png";

export interface AttachedFile {
  id: string;
  name: string;
  size: number;
  type: "text" | "image";
  content?: string;
  dataUrl?: string;
  ext?: string;
  width?: number;
  height?: number;
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
  totalSize: number;
  createdAt: string;
  updatedAt: string;
}

/** Лимит размера проекта в IndexedDB (50 МБ) */
export const PROJECT_SIZE_LIMIT = 50 * 1024 * 1024;