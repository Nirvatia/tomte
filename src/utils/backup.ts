import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";

import { translate } from "$lib/i18n";
import type { MessageKey } from "$lib/i18n/types";
import type {
  AttachedFile,
  Project,
  PromptFile,
  PromptFileVersion,
} from "../types";
import type { GithubRepoConfig } from "./github";
import type { TreeNode } from "./projectTree";
import { sanitizeFileName } from "./index";
import { downloadBlob } from "./export/common";
import {
  calculateProjectSize,
  checkProjectSize,
  saveProject,
} from "./projectDb";

/**
 * Этап 10.1. Бэкап проекта целиком (.tomte.zip).
 *
 * Всё живёт в одном браузере, поэтому бэкап — единственный способ пережить
 * очистку данных сайта или переезд на другую машину.
 *
 * Формат (v1):
 *   manifest.json   — { format, app, exportedAt }
 *   project.json    — имя, даты, файлы промптов, метаданные вложений,
 *                     github (owner/repo/branch, БЕЗ токена), дерево
 *   attachments/N-имя — содержимое вложения (текст как UTF-8, картинка
 *                     как исходные байты). binary-вложения без содержимого
 *                     выгружаются только метаданными — как в базе.
 *
 * id не выгружаются: при импорте генерируются заново, проект всегда
 * вставляется как новый (дубли не сливаются).
 */

export const BACKUP_FORMAT = 1;

interface BackupManifest {
  format: number;
  app: string;
  exportedAt: string;
}

/** Вложение в project.json: метаданные + ссылка на entry с содержимым. */
interface BackupAttachmentMeta {
  name: string;
  type: AttachedFile["type"];
  size: number;
  ext?: string;
  width?: number;
  height?: number;
  /** entry в архиве; нет — содержимого не было (binary). */
  entry?: string;
}

interface BackupPromptFile {
  name: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Узел дерева в бэкапе — только данные. fileRef (File/FileSystemFileHandle)
 * локальной папки в JSON не сериализуется: после импорта дерево — структура
 * без содержимого, папку нужно открыть заново (содержимое подтянется само).
 */
interface BackupTreeNode {
  name: string;
  path: string;
  type: "file" | "directory";
  githubRef?: { owner: string; repo: string; branch: string };
  children?: BackupTreeNode[];
}

interface BackupProject {
  name: string;
  createdAt: string;
  updatedAt: string;
  promptFiles: BackupPromptFile[];
  attachments: BackupAttachmentMeta[];
  /** Снапшоты файлов: fileId → версии (этап 10.3). */
  fileVersions?: Record<string, PromptFileVersion[]>;
  /** Настройки фильтра выбора файлов дерева (этап 10.6). */
  treeFilter?: Project["treeFilter"];
  github?: Pick<GithubRepoConfig, "owner" | "repo" | "branch">;
  tree?: {
    rootName: string;
    fileCount: number;
    nodes: BackupTreeNode[];
  };
}

function serializeTreeNodes(nodes: TreeNode[]): BackupTreeNode[] {
  return nodes.map((node) => ({
    name: node.name,
    path: node.path,
    type: node.type,
    ...(node.githubRef
      ? {
          githubRef: {
            owner: node.githubRef.owner,
            repo: node.githubRef.repo,
            branch: node.githubRef.branch,
          },
        }
      : {}),
    ...(node.type === "directory"
      ? { children: serializeTreeNodes(node.children ?? []) }
      : {}),
  }));
}

function restoreTreeNodes(nodes: BackupTreeNode[]): TreeNode[] {
  return nodes.map((node) => ({
    name: node.name,
    path: node.path,
    type: node.type,
    children: node.children ? restoreTreeNodes(node.children) : [],
    ...(node.githubRef ? { githubRef: node.githubRef } : {}),
  }));
}

function dataUrlToBytes(dataUrl: string): Uint8Array | null {
  const comma = dataUrl.indexOf(",");
  if (comma < 0) return null;
  const base64 = dataUrl.slice(comma + 1);
  if (typeof atob !== "function") return null;
  try {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

function bytesToDataUrl(bytes: Uint8Array, ext?: string): string {
  const mime =
    ext === "png"
      ? "image/png"
      : ext === "webp"
        ? "image/webp"
        : ext === "gif"
          ? "image/gif"
          : "image/jpeg";
  let binary = "";
  for (let i = 0; i < bytes.length; i++)
    binary += String.fromCharCode(bytes[i]);
  return `data:${mime};base64,${btoa(binary)}`;
}

/** Собирает архив бэкапа проекта. */
export function buildBackup(project: Project): Uint8Array {
  const entries: Record<string, Uint8Array> = {};

  const attachments: BackupAttachmentMeta[] = project.attachments.map(
    (file, index) => {
      const meta: BackupAttachmentMeta = {
        name: file.name,
        type: file.type,
        size: file.size,
        ...(file.ext !== undefined ? { ext: file.ext } : {}),
        ...(file.width !== undefined ? { width: file.width } : {}),
        ...(file.height !== undefined ? { height: file.height } : {}),
      };
      if (file.type === "binary") return meta;

      const entry = `attachments/${index}-${sanitizeFileName(file.name)}`;
      if (file.type === "text" && file.content != null) {
        entries[entry] = strToU8(file.content);
      } else if (file.type === "image" && file.dataUrl) {
        const bytes = dataUrlToBytes(file.dataUrl);
        if (!bytes) return meta;
        entries[entry] = bytes;
      } else {
        return meta;
      }
      meta.entry = entry;
      return meta;
    },
  );

  // Токен в бэкап не идём: при импорте проект остаётся привязанным
  // к репозиторию, но доступ запросится заново.
  const backup: BackupProject = {
    name: project.name,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    promptFiles: project.files.map((file) => ({
      name: file.name,
      content: file.content,
      createdAt: file.createdAt,
      updatedAt: file.updatedAt,
    })),
    attachments,
    ...(project.fileVersions ? { fileVersions: project.fileVersions } : {}),
    ...(project.treeFilter ? { treeFilter: project.treeFilter } : {}),
    ...(project.githubConfig
      ? {
          github: {
            owner: project.githubConfig.owner,
            repo: project.githubConfig.repo,
            branch: project.githubConfig.branch,
          },
        }
      : {}),
    ...(project.projectTreeSource
      ? {
          tree: {
            rootName: project.projectTreeSource.rootName,
            fileCount: project.projectTreeSource.fileCount,
            nodes: serializeTreeNodes(project.projectTreeSource.nodes ?? []),
          },
        }
      : {}),
  };

  const manifest: BackupManifest = {
    format: BACKUP_FORMAT,
    app: "tomte",
    exportedAt: new Date().toISOString(),
  };

  entries["manifest.json"] = strToU8(JSON.stringify(manifest, null, 2));
  entries["project.json"] = strToU8(JSON.stringify(backup, null, 2));
  return zipSync(entries);
}

export function exportProjectBackup(project: Project): void {
  const zipped = buildBackup(project);
  const blob = new Blob([zipped as BlobPart], { type: "application/zip" });
  downloadBlob(blob, `${sanitizeFileName(project.name)}.tomte.zip`);
}

function fail(key: MessageKey): never {
  throw new Error(translate(key));
}

/** Разбирает архив и собирает из него новый проект (с новыми id). */
export function parseBackup(bytes: Uint8Array): Project {
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(bytes);
  } catch {
    fail("backup.errors.notZip");
  }
  if (!entries["manifest.json"] || !entries["project.json"]) {
    fail("backup.errors.notBackup");
  }

  let manifest: BackupManifest;
  let backup: BackupProject;
  try {
    manifest = JSON.parse(strFromU8(entries["manifest.json"]));
    backup = JSON.parse(strFromU8(entries["project.json"]));
  } catch {
    fail("backup.errors.corrupt");
  }
  if (manifest.format !== BACKUP_FORMAT || manifest.app !== "tomte") {
    fail("backup.errors.unsupported");
  }
  if (typeof backup.name !== "string" || !backup.name.trim()) {
    fail("backup.errors.corrupt");
  }

  const now = new Date().toISOString();
  const files: PromptFile[] = (backup.promptFiles ?? []).map((file) => ({
    id: crypto.randomUUID(),
    name: file.name,
    content: file.content ?? "",
    createdAt: file.createdAt ?? now,
    updatedAt: file.updatedAt ?? now,
  }));

  const attachments: AttachedFile[] = (backup.attachments ?? []).map((meta) => {
    const file: AttachedFile = {
      id: crypto.randomUUID(),
      name: meta.name,
      type: meta.type,
      size: meta.size,
      ...(meta.ext !== undefined ? { ext: meta.ext } : {}),
      ...(meta.width !== undefined ? { width: meta.width } : {}),
      ...(meta.height !== undefined ? { height: meta.height } : {}),
    };
    const entry = meta.entry ? entries[meta.entry] : undefined;
    if (entry) {
      if (meta.type === "text") {
        file.content = strFromU8(entry);
      } else if (meta.type === "image") {
        file.dataUrl = bytesToDataUrl(entry, meta.ext);
      }
    }
    return file;
  });

  const project: Project = {
    id: crypto.randomUUID(),
    name: backup.name,
    files,
    attachments,
    totalSize: 0,
    createdAt: backup.createdAt ?? now,
    updatedAt: backup.updatedAt ?? now,
  };
  if (backup.github) {
    project.githubConfig = { ...backup.github };
  }
  if (backup.fileVersions) {
    project.fileVersions = backup.fileVersions;
  }
  if (backup.treeFilter) {
    project.treeFilter = backup.treeFilter;
  }
  if (backup.tree) {
    project.projectTreeSource = {
      rootName: backup.tree.rootName,
      fileCount: backup.tree.fileCount,
      nodes: restoreTreeNodes(backup.tree.nodes ?? []),
    };
  }
  project.totalSize = calculateProjectSize(project);

  const { ok } = checkProjectSize(project);
  if (!ok) fail("backup.errors.tooLarge");
  return project;
}

/** Импорт: архив → новый проект в базе. Возвращает готовый проект. */
export async function importProjectBackup(bytes: Uint8Array): Promise<Project> {
  const project = parseBackup(bytes);
  await saveProject(project);
  return project;
}
