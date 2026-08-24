import { openDB, type IDBPDatabase } from "idb";

import type { Project, AttachedFile } from "../types";
import { PROJECT_SIZE_LIMIT } from "../types";
import type { TreeNode } from "./projectTree";

const DB_NAME = "tomte-projects-db";
const DB_VERSION = 1;
const STORE_NAME = "projects";

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: "id" });
        }
      },
    });
  }
  return dbPromise;
}

export async function saveProject(project: Project): Promise<void> {
  try {
    const db = await getDB();
    await db.put(STORE_NAME, project);
  } catch (error) {
    console.error("Failed to save project to IndexedDB:", error);
    throw new Error(
      "Не удалось сохранить проект. Возможно, превышена квота хранилища браузера.",
    );
  }
}

export async function loadProject(id: string): Promise<Project | null> {
  const db = await getDB();
  const project = await db.get(STORE_NAME, id);
  return project ?? null;
}

export async function loadAllProjects(): Promise<Project[]> {
  const db = await getDB();
  const projects = await db.getAll(STORE_NAME);
  return projects;
}

export async function deleteProject(id: string): Promise<void> {
  const db = await getDB();
  await db.delete(STORE_NAME, id);
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

export function calculateProjectSize(project: Project): number {
  let size = 1024;
  size += project.id?.length ?? 0;
  size += project.name?.length ?? 0;

  for (const file of project.files ?? []) {
    size += 160 + (file.name?.length ?? 0);
    size += new Blob([file.content ?? ""]).size;
  }

  for (const attachment of project.attachments ?? []) {
    size +=
      220 + (attachment.name?.length ?? 0) + (attachment.ext?.length ?? 0);
    if (attachment.content) {
      size += new Blob([attachment.content]).size;
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
    name: "main.md",
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

export async function initializeActiveProject(): Promise<Project> {
  try {
    const projects = await loadAllProjects();
    if (projects.length === 0) {
      const newProject = createEmptyProject();
      await saveProject(newProject);
      return newProject;
    }
    return [...projects].sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt),
    )[0];
  } catch (error) {
    console.error("Failed to initialize project:", error);
    return createEmptyProject();
  }
}
