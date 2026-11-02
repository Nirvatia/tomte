import { openDB, type IDBPDatabase, type IDBPTransaction } from "idb";

import type { Project, AttachedFile, ProjectTreeSource } from "../types";
import { PROJECT_SIZE_LIMIT } from "../types";
import type { TreeNode } from "./projectTree";

/*
 * Схема хранения (v2).
 *
 * Проект разнесён по трём хранилищам, чтобы автосохранение текста
 * не перезаписывало мегабайты вложений и файлов дерева:
 *
 *  - projects:    метаданные проекта и файлы промптов (лёгкая запись);
 *  - attachments: по записи на вложение, индекс по projectId;
 *  - trees:       дерево проекта вместе с содержимым файлов, одна запись на проект.
 *
 * Снаружи по-прежнему виден цельный Project: loadProject собирает его,
 * saveProject раскладывает. Второй аргумент saveProject говорит,
 * какие части реально изменились и должны быть записаны.
 */

const DB_NAME = "tomte-projects-db";
const DB_VERSION = 2;
const PROJECTS = "projects";
const ATTACHMENTS = "attachments";
const TREES = "trees";
const BY_PROJECT = "projectId";

type StoreName = typeof PROJECTS | typeof ATTACHMENTS | typeof TREES;
type UpgradeTx = IDBPTransaction<unknown, StoreName[], "versionchange">;

/** Запись в хранилище projects. */
interface StoredProjectMeta extends Omit<
  Project,
  "attachments" | "projectTreeSource"
> {
  /** Порядок вложений. Сами вложения лежат в attachments. */
  attachmentIds: string[];
  hasTree: boolean;
}

interface StoredAttachment extends AttachedFile {
  projectId: string;
}

interface StoredTree {
  projectId: string;
  source: ProjectTreeSource;
}

/** Лёгкое описание проекта для списков: без вложений и дерева. */
export interface ProjectSummary {
  id: string;
  name: string;
  fileCount: number;
  attachmentCount: number;
  hasTree: boolean;
  totalSize: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Что записать помимо метаданных и файлов промптов (они пишутся всегда).
 *
 * attachments:
 *  - "all": перезаписать все вложения проекта;
 *  - { put, delete }: записать или удалить только указанные.
 * tree: записать дерево (или удалить, если его нет в проекте).
 */
export interface ProjectSaveChanges {
  attachments?: "all" | { put?: AttachedFile[]; delete?: Iterable<string> };
  tree?: boolean;
}

/** Только метаданные и промпты. Для автосохранения, переименований и т.п. */
export const SAVE_META: ProjectSaveChanges = {};
const SAVE_ALL: ProjectSaveChanges = { attachments: "all", tree: true };

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      async upgrade(db, oldVersion, _newVersion, tx) {
        if (!db.objectStoreNames.contains(PROJECTS)) {
          db.createObjectStore(PROJECTS, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(ATTACHMENTS)) {
          const store = db.createObjectStore(ATTACHMENTS, { keyPath: "id" });
          store.createIndex(BY_PROJECT, BY_PROJECT);
        }
        if (!db.objectStoreNames.contains(TREES)) {
          db.createObjectStore(TREES, { keyPath: BY_PROJECT });
        }
        if (oldVersion === 1) {
          await migrateV1(tx as unknown as UpgradeTx);
        }
      },
    });
    // Не кэшируем неудачное открытие: следующий вызов попробует снова.
    dbPromise.catch(() => {
      dbPromise = null;
    });
  }
  return dbPromise;
}

/** v1 хранил проект целиком одной записью. Раскладываем по хранилищам. */
async function migrateV1(tx: UpgradeTx): Promise<void> {
  const projects = tx.objectStore(PROJECTS);
  const attachments = tx.objectStore(ATTACHMENTS);
  const trees = tx.objectStore(TREES);

  let cursor = await projects.openCursor();
  while (cursor) {
    const legacy = cursor.value as Project;
    const { meta, attachmentRecords, treeRecord } = splitProject(legacy);

    for (const record of attachmentRecords) {
      await attachments.put(record);
    }
    if (treeRecord) {
      await trees.put(treeRecord);
    }
    await cursor.update(meta);
    cursor = await cursor.continue();
  }
}

/** Убирает GitHub-токен из узлов дерева: он хранится только в githubConfig. */
export function stripGithubTokens(nodes: TreeNode[]): TreeNode[] {
  return nodes.map((node) => {
    let next = node;
    if (node.githubRef && "token" in node.githubRef) {
      const { owner, repo, branch } = node.githubRef;
      next = { ...node, githubRef: { owner, repo, branch } };
    }
    if (node.children?.length) {
      next = { ...next, children: stripGithubTokens(node.children) };
    }
    return next;
  });
}

function toMeta(project: Project): StoredProjectMeta {
  const { attachments, projectTreeSource, ...rest } = project;
  return {
    ...rest,
    attachmentIds: (attachments ?? []).map((a) => a.id),
    hasTree: Boolean(projectTreeSource),
  };
}

function toAttachmentRecord(
  projectId: string,
  file: AttachedFile,
): StoredAttachment {
  return { ...file, projectId };
}

function toTreeRecord(project: Project): StoredTree | null {
  if (!project.projectTreeSource) return null;
  return {
    projectId: project.id,
    source: {
      ...project.projectTreeSource,
      nodes: stripGithubTokens(project.projectTreeSource.nodes ?? []),
    },
  };
}

function splitProject(project: Project) {
  return {
    meta: toMeta(project),
    attachmentRecords: (project.attachments ?? []).map((a) =>
      toAttachmentRecord(project.id, a),
    ),
    treeRecord: toTreeRecord(project),
  };
}

function fromAttachmentRecord(record: StoredAttachment): AttachedFile {
  const { projectId: _projectId, ...file } = record;
  return file;
}

function toSummary(meta: StoredProjectMeta): ProjectSummary {
  return {
    id: meta.id,
    name: meta.name,
    fileCount: meta.files?.length ?? 0,
    attachmentCount: meta.attachmentIds?.length ?? 0,
    hasTree: Boolean(meta.hasTree),
    totalSize: meta.totalSize ?? 0,
    createdAt: meta.createdAt,
    updatedAt: meta.updatedAt,
  };
}

export async function saveProject(
  project: Project,
  changes: ProjectSaveChanges = SAVE_ALL,
): Promise<void> {
  try {
    const db = await getDB();
    const tx = db.transaction([PROJECTS, ATTACHMENTS, TREES], "readwrite");
    const ops: Promise<unknown>[] = [
      tx.objectStore(PROJECTS).put(toMeta(project)),
    ];

    const attachmentStore = tx.objectStore(ATTACHMENTS);
    if (changes.attachments === "all") {
      const oldKeys = await attachmentStore
        .index(BY_PROJECT)
        .getAllKeys(project.id);
      const keep = new Set((project.attachments ?? []).map((a) => a.id));
      for (const key of oldKeys) {
        if (!keep.has(key as string)) ops.push(attachmentStore.delete(key));
      }
      for (const file of project.attachments ?? []) {
        ops.push(attachmentStore.put(toAttachmentRecord(project.id, file)));
      }
    } else if (changes.attachments) {
      for (const id of changes.attachments.delete ?? []) {
        ops.push(attachmentStore.delete(id));
      }
      for (const file of changes.attachments.put ?? []) {
        ops.push(attachmentStore.put(toAttachmentRecord(project.id, file)));
      }
    }

    if (changes.tree) {
      const treeRecord = toTreeRecord(project);
      const treeStore = tx.objectStore(TREES);
      ops.push(
        treeRecord ? treeStore.put(treeRecord) : treeStore.delete(project.id),
      );
    }

    await Promise.all([...ops, tx.done]);
  } catch (error) {
    console.error("Failed to save project to IndexedDB:", error);
    throw new Error(
      "Не удалось сохранить проект. Возможно, превышена квота хранилища браузера.",
    );
  }
}

export async function loadProject(id: string): Promise<Project | null> {
  const db = await getDB();
  const tx = db.transaction([PROJECTS, ATTACHMENTS, TREES], "readonly");
  const [meta, attachmentRecords, treeRecord] = await Promise.all([
    tx.objectStore(PROJECTS).get(id) as Promise<StoredProjectMeta | undefined>,
    tx.objectStore(ATTACHMENTS).index(BY_PROJECT).getAll(id) as Promise<
      StoredAttachment[]
    >,
    tx.objectStore(TREES).get(id) as Promise<StoredTree | undefined>,
    tx.done,
  ]);
  if (!meta) return null;

  const byId = new Map(attachmentRecords.map((r) => [r.id, r]));
  const ordered: AttachedFile[] = [];
  for (const attachmentId of meta.attachmentIds ?? []) {
    const record = byId.get(attachmentId);
    if (record) {
      ordered.push(fromAttachmentRecord(record));
      byId.delete(attachmentId);
    }
  }
  // Записи, которых нет в порядке (не должно случаться), не теряем.
  for (const record of byId.values()) {
    ordered.push(fromAttachmentRecord(record));
  }

  const { attachmentIds: _ids, hasTree: _hasTree, ...rest } = meta;
  const project: Project = { ...rest, attachments: ordered };
  if (treeRecord) {
    project.projectTreeSource = treeRecord.source;
  }
  return project;
}

/** Список проектов без вложений и деревьев, свежие сверху. */
export async function loadProjectSummaries(): Promise<ProjectSummary[]> {
  const db = await getDB();
  const metas = (await db.getAll(PROJECTS)) as StoredProjectMeta[];
  return metas
    .map(toSummary)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function deleteProject(id: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction([PROJECTS, ATTACHMENTS, TREES], "readwrite");
  const attachmentStore = tx.objectStore(ATTACHMENTS);
  const keys = await attachmentStore.index(BY_PROJECT).getAllKeys(id);
  await Promise.all([
    tx.objectStore(PROJECTS).delete(id),
    tx.objectStore(TREES).delete(id),
    ...keys.map((key) => attachmentStore.delete(key)),
    tx.done,
  ]);
}

/** Размер строки в UTF-8 без создания Blob. */
export function utf8ByteLength(text: string): number {
  let bytes = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff) {
      bytes += 4; // суррогатная пара
      i++;
    } else bytes += 3;
  }
  return bytes;
}

function estimateTreeNodesSize(nodes: TreeNode[]): number {
  let size = 0;
  const stack: TreeNode[] = [...nodes];
  const hasFileGlobal = typeof File !== "undefined";

  while (stack.length > 0) {
    const node = stack.pop()!;
    size += 160 + (node.name?.length ?? 0) + (node.path?.length ?? 0);

    if (hasFileGlobal && node.fileRef instanceof File) {
      size += node.fileRef.size;
    } else if (node.fileRef) {
      size += 1024;
    }

    if (node.githubRef) {
      size += 80;
    }
    if (node.children?.length) {
      stack.push(...node.children);
    }
  }
  return size;
}

/** Оценка размера файла промпта (используется и для дельты при наборе). */
export function estimatePromptFileSize(file: {
  name?: string;
  content?: string;
}): number {
  return 160 + (file.name?.length ?? 0) + utf8ByteLength(file.content ?? "");
}

export function calculateProjectSize(project: Project): number {
  let size = 1024;
  size += project.id?.length ?? 0;
  size += project.name?.length ?? 0;

  for (const file of project.files ?? []) {
    size += estimatePromptFileSize(file);
  }

  for (const attachment of project.attachments ?? []) {
    size +=
      220 + (attachment.name?.length ?? 0) + (attachment.ext?.length ?? 0);
    if (attachment.content) {
      size += utf8ByteLength(attachment.content);
    }
    if (attachment.dataUrl) {
      size += attachment.dataUrl.length;
    }
  }

  if (project.projectTreeSource) {
    size += 160 + (project.projectTreeSource.rootName?.length ?? 0);
    size += estimateTreeNodesSize(project.projectTreeSource.nodes ?? []);
  }

  if (project.githubConfig) {
    size += 160;
    size += project.githubConfig.owner?.length ?? 0;
    size += project.githubConfig.repo?.length ?? 0;
    size += project.githubConfig.branch?.length ?? 0;
    size += project.githubConfig.token?.length ?? 0;
  }

  return size;
}

export function checkProjectSize(project: Project): {
  ok: boolean;
  size: number;
  limit: number;
} {
  const size = calculateProjectSize(project);
  return {
    ok: size <= PROJECT_SIZE_LIMIT,
    size,
    limit: PROJECT_SIZE_LIMIT,
  };
}

export function createEmptyProject(name: string = "Untitled Project"): Project {
  const now = new Date().toISOString();
  const mainFile = {
    id: crypto.randomUUID(),
    name: "main",
    content: "",
    createdAt: now,
    updatedAt: now,
  };

  const project: Project = {
    id: crypto.randomUUID(),
    name,
    files: [mainFile],
    attachments: [],
    totalSize: 0,
    createdAt: now,
    updatedAt: now,
  };
  project.totalSize = calculateProjectSize(project);
  return project;
}

/**
 * Проект для старта: preferredId (последний открытый), если он ещё есть,
 * иначе самый свежий, иначе новый пустой.
 */
export async function initializeActiveProject(
  preferredId?: string | null,
): Promise<Project> {
  try {
    if (preferredId) {
      const preferred = await loadProject(preferredId);
      if (preferred) return preferred;
    }
    const summaries = await loadProjectSummaries();
    for (const summary of summaries) {
      const project = await loadProject(summary.id);
      if (project) return project;
    }
    const newProject = createEmptyProject();
    await saveProject(newProject);
    return newProject;
  } catch (error) {
    console.error("Failed to initialize project:", error);
    return createEmptyProject();
  }
}
