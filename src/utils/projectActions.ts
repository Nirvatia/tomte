import { get } from "svelte/store";

import type {
  AttachedFile,
  Project,
  ProjectTreeSource,
  PromptFile,
} from "../types";
import type { TreeNode } from "./projectTree";
import type { GithubRepoConfig } from "./github";

import {
  activeProject,
  projectTreeNodes,
  projectTreeRootName,
  projectTreeString,
  openFileIds,
  previewFileId,
  activeFileId,
  selectedFileIds,
  selectedProjectFiles,
  previewFileFromTree,
  editorHtml,
  fileName,
  pendingSaveController,
} from "../stores";
import { requestConfirm } from "../stores/confirm";

import {
  saveProject,
  checkProjectSize,
  loadProject,
  deleteProject,
  loadAllProjects,
  createEmptyProject,
  calculateProjectSize,
} from "./projectDb";
import { buildTreeString, calculateStats } from "./projectTree";
import { fetchGithubTree } from "./github";

const IDB_MAX_BYTES = 25 * 1024 * 1024;

export async function flushPendingEditorSave(): Promise<void> {
  const controller = get(pendingSaveController);
  if (!controller) return;
  try {
    await controller.flush();
  } catch (error) {
    console.error("Failed to flush pending editor save:", error);
  }
}

function resetProjectScopedStores(): void {
  selectedFileIds.set(new Set());
  selectedProjectFiles.set([]);
  previewFileFromTree.set(null);
  editorHtml.set("");
  fileName.set("prompt");
}

export function applyProjectToStores(project: Project): void {
  previewFileId.set(null);
  activeFileId.set(null);
  openFileIds.set([]);
  resetProjectScopedStores();
  activeProject.set(project);

  if (project.files.length > 0) {
    openFileIds.set([project.files[0].id]);
    activeFileId.set(project.files[0].id);
  }

  if (project.projectTreeSource) {
    projectTreeNodes.set(project.projectTreeSource.nodes);
    projectTreeRootName.set(project.projectTreeSource.rootName);
    projectTreeString.set(
      buildTreeString(
        project.projectTreeSource.rootName,
        project.projectTreeSource.nodes,
      ),
    );
  } else {
    projectTreeNodes.set([]);
    projectTreeRootName.set("");
    projectTreeString.set("");
  }
}

function createPromptFileObject(name: string, content = ""): PromptFile {
  const now = new Date().toISOString();
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
  if (desired && desired.trim()) {
    const base = desired.trim();
    if (!names.has(base.toLowerCase())) {
      return base;
    }
    const dotIndex = base.lastIndexOf(".");
    const stem = dotIndex > 0 ? base.slice(0, dotIndex) : base;
    const ext = dotIndex > 0 ? base.slice(dotIndex) : "";
    let counter = 2;
    let candidate = `${stem} (${counter})${ext}`;
    while (names.has(candidate.toLowerCase())) {
      counter += 1;
      candidate = `${stem} (${counter})${ext}`;
    }
    return candidate;
  }
  let counter = 1;
  let candidate = `prompt-${counter}.md`;
  while (names.has(candidate.toLowerCase())) {
    counter += 1;
    candidate = `prompt-${counter}.md`;
  }
  return candidate;
}

export async function createPromptFile(name?: string): Promise<string | null> {
  await flushPendingEditorSave();
  const project = get(activeProject);
  if (!project) return null;

  const uniqueName = getUniquePromptFileName(project, name);
  const newFile = createPromptFileObject(uniqueName, "");
  const now = new Date().toISOString();

  const updatedProject: Project = {
    ...project,
    files: [...project.files, newFile],
    updatedAt: now,
    totalSize: 0,
  };
  updatedProject.totalSize = calculateProjectSize(updatedProject);
  activeProject.set(updatedProject);
  await saveProject(updatedProject);

  openFileIds.update((ids) =>
    ids.includes(newFile.id) ? ids : [...ids, newFile.id],
  );
  previewFileId.set(null);
  activeFileId.set(newFile.id);

  return newFile.id;
}

export async function renamePromptFile(
  fileId: string,
  newName: string,
): Promise<boolean> {
  const trimmedName = newName.trim();
  if (!fileId || !trimmedName) return false;

  await flushPendingEditorSave();
  const project = get(activeProject);
  if (!project) return false;

  const file = project.files.find((f) => f.id === fileId);
  if (!file) return false;
  if (file.name === trimmedName) return true;

  const now = new Date().toISOString();
  const updatedFiles = project.files.map((f) =>
    f.id === fileId ? { ...f, name: trimmedName, updatedAt: now } : f,
  );

  const updatedProject: Project = {
    ...project,
    files: updatedFiles,
    updatedAt: now,
    totalSize: 0,
  };
  updatedProject.totalSize = calculateProjectSize(updatedProject);
  activeProject.set(updatedProject);
  await saveProject(updatedProject);

  return true;
}

export async function deletePromptFile(fileId: string): Promise<boolean> {
  if (!fileId) return false;

  await flushPendingEditorSave();
  const project = get(activeProject);
  if (!project) return false;

  const existingFile = project.files.find((f) => f.id === fileId);
  if (!existingFile) return false;

  const oldOpenIds = get(openFileIds);
  const oldActiveId = get(activeFileId);
  const oldPreviewId = get(previewFileId);

  let updatedFiles = project.files.filter((f) => f.id !== fileId);
  let createdFile: PromptFile | null = null;

  if (updatedFiles.length === 0) {
    createdFile = createPromptFileObject("main.md", "");
    updatedFiles = [createdFile];
  }

  const now = new Date().toISOString();
  const updatedProject: Project = {
    ...project,
    files: updatedFiles,
    updatedAt: now,
    totalSize: 0,
  };
  updatedProject.totalSize = calculateProjectSize(updatedProject);

  let nextOpenIds = oldOpenIds.filter((id) =>
    updatedFiles.some((f) => f.id === id),
  );
  if (createdFile) {
    nextOpenIds = [createdFile.id];
  }

  let nextActiveId: string | null = oldActiveId;
  if (!updatedFiles.some((f) => f.id === nextActiveId)) {
    if (createdFile) {
      nextActiveId = createdFile.id;
    } else if (nextOpenIds.length > 0) {
      const closedIndex = oldOpenIds.indexOf(fileId);
      const safeIndex = Math.min(
        Math.max(closedIndex, 0),
        nextOpenIds.length - 1,
      );
      nextActiveId = nextOpenIds[safeIndex];
    } else if (
      oldPreviewId &&
      oldPreviewId !== fileId &&
      updatedFiles.some((f) => f.id === oldPreviewId)
    ) {
      nextActiveId = oldPreviewId;
    } else if (updatedFiles.length > 0) {
      nextActiveId = updatedFiles[0].id;
    } else {
      nextActiveId = null;
    }
  }

  activeProject.set(updatedProject);
  await saveProject(updatedProject);
  openFileIds.set(nextOpenIds);

  if (createdFile) {
    previewFileId.set(null);
    activeFileId.set(createdFile.id);
    return true;
  }

  if (oldPreviewId === fileId) {
    previewFileId.set(null);
  }
  activeFileId.set(nextActiveId);

  if (nextActiveId && !nextOpenIds.includes(nextActiveId)) {
    previewFileId.set(nextActiveId);
  }

  return true;
}

export async function activatePromptFile(fileId: string): Promise<void> {
  await flushPendingEditorSave();
  const project = get(activeProject);
  if (!project) return;

  const file = project.files.find((f) => f.id === fileId);
  if (!file) return;
  activeFileId.set(fileId);
}

export async function previewPromptFile(fileId: string): Promise<void> {
  await flushPendingEditorSave();
  const project = get(activeProject);
  if (!project) return;

  const file = project.files.find((f) => f.id === fileId);
  if (!file) return;

  const openIds = get(openFileIds);
  if (!openIds.includes(fileId)) {
    previewFileId.set(fileId);
  }
  activeFileId.set(fileId);
}

export async function pinPromptFile(fileId: string): Promise<void> {
  await flushPendingEditorSave();
  const project = get(activeProject);
  if (!project) return;

  const file = project.files.find((f) => f.id === fileId);
  if (!file) return;

  openFileIds.update((ids) => (ids.includes(fileId) ? ids : [...ids, fileId]));
  previewFileId.set(null);
  activeFileId.set(fileId);
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

  let nextActiveId: string | null = null;
  if (remainingOpenIds.length > 0) {
    const closedIndex = openIds.indexOf(fileId);
    const safeIndex = Math.min(
      Math.max(closedIndex, 0),
      remainingOpenIds.length - 1,
    );
    nextActiveId = remainingOpenIds[safeIndex];
  } else if (previewId && project.files.some((f) => f.id === previewId)) {
    nextActiveId = previewId;
  }

  activeFileId.set(nextActiveId);
}

export async function clearActiveFileContent(): Promise<void> {
  await flushPendingEditorSave();
  const project = get(activeProject);
  const fileId = get(activeFileId);
  if (!project || !fileId) return;

  const updatedFiles = project.files.map((f) =>
    f.id === fileId
      ? { ...f, content: "", updatedAt: new Date().toISOString() }
      : f,
  );

  const updatedProject: Project = {
    ...project,
    files: updatedFiles,
    updatedAt: new Date().toISOString(),
    totalSize: 0,
  };
  updatedProject.totalSize = calculateProjectSize(updatedProject);
  activeProject.set(updatedProject);
  await saveProject(updatedProject);
}

export async function addAttachmentsToProject(
  files: AttachedFile[],
): Promise<void> {
  await flushPendingEditorSave();
  const project = get(activeProject);
  if (!project || files.length === 0) return;

  const updatedAt = new Date().toISOString();
  let updatedProject: Project = {
    ...project,
    attachments: [...project.attachments, ...files],
    updatedAt,
  };

  let sizeCheck = checkProjectSize(updatedProject);
  if (sizeCheck.ok) {
    updatedProject.totalSize = sizeCheck.size;
    activeProject.set(updatedProject);
    await saveProject(updatedProject);
    return;
  }

  const liteNewFiles: AttachedFile[] = files.map((f) => ({
    id: f.id,
    name: f.name,
    size: f.size,
    type: f.type,
    ext: f.ext,
    width: f.width,
    height: f.height,
  }));

  const liteUpdatedProject: Project = {
    ...project,
    attachments: [...project.attachments, ...liteNewFiles],
    updatedAt,
  };

  const liteSizeCheck = checkProjectSize(liteUpdatedProject);
  const limitMB = (liteSizeCheck.limit / 1024 / 1024).toFixed(0);
  const fullSizeMB = (sizeCheck.size / 1024 / 1024).toFixed(1);

  const confirmed = await requestConfirm({
    title: "Превышен лимит проекта",
    message:
      `Размер с содержимым новых файлов: ${fullSizeMB} МБ.\n` +
      `Лимит проекта: ${limitMB} МБ.\n\n` +
      `Добавить новые файлы только как метаданные, без содержимого?\n` +
      `Существующие вложения изменены не будут.`,
    confirmText: "Добавить как метаданные",
    cancelText: "Отмена",
  });

  if (!confirmed) {
    throw new Error("Файлы не добавлены: превышен лимит проекта.");
  }

  if (!liteSizeCheck.ok) {
    throw new Error(
      "Даже метаданные новых файлов превышают лимит проекта. Удалите что-нибудь из проекта.",
    );
  }

  liteUpdatedProject.totalSize = liteSizeCheck.size;
  activeProject.set(liteUpdatedProject);
  await saveProject(liteUpdatedProject);
}

export async function removeAttachmentFromProject(
  fileId: string,
): Promise<void> {
  await flushPendingEditorSave();
  const project = get(activeProject);
  if (!project) return;

  const updatedProject: Project = {
    ...project,
    attachments: project.attachments.filter((f) => f.id !== fileId),
    updatedAt: new Date().toISOString(),
    totalSize: 0,
  };
  updatedProject.totalSize = calculateProjectSize(updatedProject);
  activeProject.set(updatedProject);
  await saveProject(updatedProject);

  selectedFileIds.update((ids) => {
    const next = new Set(ids);
    next.delete(fileId);
    return next;
  });
}

export async function removeAttachmentsFromProject(
  fileIds: Set<string>,
): Promise<void> {
  await flushPendingEditorSave();
  const project = get(activeProject);
  if (!project) return;

  const updatedProject: Project = {
    ...project,
    attachments: project.attachments.filter((f) => !fileIds.has(f.id)),
    updatedAt: new Date().toISOString(),
    totalSize: 0,
  };
  updatedProject.totalSize = calculateProjectSize(updatedProject);
  activeProject.set(updatedProject);
  await saveProject(updatedProject);

  selectedFileIds.update((ids) => {
    const next = new Set(ids);
    for (const id of fileIds) {
      next.delete(id);
    }
    return next;
  });
}

export async function removeSelectedAttachmentsFromProject(): Promise<number> {
  await flushPendingEditorSave();
  const project = get(activeProject);
  if (!project) return 0;

  const selected = get(selectedFileIds);
  const idsToDelete = new Set(
    project.attachments
      .filter((file) => selected.has(file.id))
      .map((file) => file.id),
  );

  if (idsToDelete.size === 0) {
    selectedFileIds.set(new Set());
    return 0;
  }

  const updatedProject: Project = {
    ...project,
    attachments: project.attachments.filter(
      (file) => !idsToDelete.has(file.id),
    ),
    updatedAt: new Date().toISOString(),
    totalSize: 0,
  };
  updatedProject.totalSize = calculateProjectSize(updatedProject);
  activeProject.set(updatedProject);
  await saveProject(updatedProject);

  selectedFileIds.update((ids) => {
    const next = new Set(ids);
    for (const id of idsToDelete) {
      next.delete(id);
    }
    return next;
  });

  return idsToDelete.size;
}

export async function clearAttachmentsFromProject(): Promise<void> {
  await flushPendingEditorSave();
  const project = get(activeProject);
  if (!project) return;

  const updatedProject: Project = {
    ...project,
    attachments: [],
    updatedAt: new Date().toISOString(),
    totalSize: 0,
  };
  updatedProject.totalSize = calculateProjectSize(updatedProject);
  activeProject.set(updatedProject);
  await saveProject(updatedProject);
  selectedFileIds.set(new Set());
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
    if (validIds.size === currentIds.size) {
      return currentIds;
    }
    return validIds;
  });
}

async function materializeFiles(nodes: TreeNode[]): Promise<TreeNode[] | null> {
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
        if (totalBytes > IDB_MAX_BYTES) return null;
      }
      result.push({ ...item, fileRef: file });
    }
    return result;
  }

  return walk(nodes);
}

function stripFileRefs(nodes: TreeNode[]): TreeNode[] {
  return nodes.map((node) => {
    if (node.type === "directory") {
      return { ...node, children: stripFileRefs(node.children) };
    }
    return { ...node, fileRef: undefined };
  });
}

export async function setProjectTreeSource(
  source: ProjectTreeSource,
): Promise<boolean> {
  await flushPendingEditorSave();
  const project = get(activeProject);
  if (!project) return false;

  const materializedNodes = await materializeFiles(source.nodes);
  const nodes = materializedNodes ?? stripFileRefs(source.nodes);

  const treeSource: ProjectTreeSource = {
    rootName: source.rootName,
    nodes,
    fileCount: source.fileCount,
  };

  let updatedProject: Project = {
    ...project,
    projectTreeSource: treeSource,
    updatedAt: new Date().toISOString(),
    totalSize: 0,
  };

  let sizeCheck = checkProjectSize(updatedProject);
  if (!sizeCheck.ok) {
    const limitMB = (sizeCheck.limit / 1024 / 1024).toFixed(0);
    const confirmed = await requestConfirm({
      title: "Превышен лимит проекта",
      message:
        `Размер дерева превышает лимит ${limitMB} МБ.\n` +
        `Дерево будет сохранено без содержимого файлов (только структура).\n` +
        `Продолжить?`,
      confirmText: "Сохранить структуру",
      cancelText: "Отмена",
    });

    if (!confirmed) return false;

    updatedProject = {
      ...updatedProject,
      projectTreeSource: {
        ...treeSource,
        nodes: stripFileRefs(nodes),
      },
    };
    sizeCheck = checkProjectSize(updatedProject);

    if (!sizeCheck.ok) {
      throw new Error(
        "Даже дерево без содержимого файлов превышает лимит проекта. Удалите часть данных и попробуйте снова.",
      );
    }
  }

  updatedProject.totalSize = sizeCheck.size;
  activeProject.set(updatedProject);
  await saveProject(updatedProject);

  const saved = updatedProject.projectTreeSource!;
  projectTreeNodes.set(saved.nodes);
  projectTreeRootName.set(saved.rootName);
  projectTreeString.set(buildTreeString(saved.rootName, saved.nodes));
  selectedProjectFiles.set([]);
  previewFileFromTree.set(null);

  return true;
}

export async function clearProjectTreeSource(): Promise<void> {
  await flushPendingEditorSave();
  const project = get(activeProject);
  if (!project) return;

  const updatedProject: Project = {
    ...project,
    projectTreeSource: undefined,
    updatedAt: new Date().toISOString(),
    totalSize: 0,
  };
  updatedProject.totalSize = calculateProjectSize(updatedProject);
  activeProject.set(updatedProject);
  await saveProject(updatedProject);

  projectTreeNodes.set([]);
  projectTreeRootName.set("");
  projectTreeString.set("");
  selectedProjectFiles.set([]);
  previewFileFromTree.set(null);
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

export async function setGithubConfig(config: GithubRepoConfig): Promise<void> {
  await flushPendingEditorSave();
  const project = get(activeProject);
  if (!project) return;

  const updatedProject: Project = {
    ...project,
    githubConfig: config,
    updatedAt: new Date().toISOString(),
    totalSize: 0,
  };
  updatedProject.totalSize = calculateProjectSize(updatedProject);
  activeProject.set(updatedProject);
  await saveProject(updatedProject);
}

export async function clearGithubConfig(): Promise<void> {
  await flushPendingEditorSave();
  const project = get(activeProject);
  if (!project) return;

  const updatedProject: Project = {
    ...project,
    githubConfig: undefined,
    updatedAt: new Date().toISOString(),
    totalSize: 0,
  };
  updatedProject.totalSize = calculateProjectSize(updatedProject);
  activeProject.set(updatedProject);
  await saveProject(updatedProject);
}

export async function switchProject(projectId: string): Promise<void> {
  await flushPendingEditorSave();
  const project = await loadProject(projectId);
  if (!project) return;
  applyProjectToStores(project);
}

export async function createNewProject(name?: string): Promise<void> {
  await flushPendingEditorSave();
  const newProject = createEmptyProject(
    name?.trim() || "Untitled Project",
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
  const project =
    current?.id === projectId ? current : await loadProject(projectId);
  if (!project) return;

  const updatedProject: Project = {
    ...project,
    name: trimmedName,
    updatedAt: new Date().toISOString(),
    totalSize: 0,
  };
  updatedProject.totalSize = calculateProjectSize(updatedProject);
  await saveProject(updatedProject);

  if (current?.id === projectId) {
    activeProject.set(updatedProject);
  }
}

export async function deleteProjectById(projectId: string): Promise<boolean> {
  await flushPendingEditorSave();
  const allProjects = await loadAllProjects();
  if (allProjects.length <= 1) return false;

  await deleteProject(projectId);
  const current = get(activeProject);

  if (current?.id === projectId) {
    const remaining = await loadAllProjects();
    const latest = [...remaining].sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt),
    )[0];

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

export async function duplicateProjectById(projectId: string): Promise<void> {
  await flushPendingEditorSave();
  const current = get(activeProject);
  const source =
    current?.id === projectId ? current : await loadProject(projectId);
  if (!source) return;

  const now = new Date().toISOString();
  const newFiles = source.files.map((f) => ({
    ...f,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
  }));
  const newAttachments = source.attachments.map((a) => ({
    ...a,
    id: crypto.randomUUID(),
  }));

  const newProject: Project = {
    ...source,
    id: crypto.randomUUID(),
    name: `${source.name} (копия)`,
    files: newFiles,
    attachments: newAttachments,
    projectTreeSource: source.projectTreeSource
      ? { ...source.projectTreeSource }
      : undefined,
    githubConfig: source.githubConfig ? { ...source.githubConfig } : undefined,
    createdAt: now,
    updatedAt: now,
    totalSize: 0,
  };

  const sizeCheck = checkProjectSize(newProject);
  if (!sizeCheck.ok) {
    throw new Error(
      "Копия проекта превышает лимит. Удалите часть данных и попробуйте снова.",
    );
  }

  newProject.totalSize = sizeCheck.size;
  await saveProject(newProject);
}
