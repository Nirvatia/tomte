/**
 * Дерево проекта, GitHub и фильтры выбора файлов.
 * Часть projectActions (этап 15.1); снаружи импортируется через него.
 */
import { translate } from "$lib/i18n";
import { get } from "svelte/store";
import {
  type Project,
  type ProjectTreeSource,
  type TreeFilterSettings,
  PROJECT_SIZE_LIMIT,
} from "../../types";
import {
  type TreeNode,
  calculateStats,
  getTreeGithubConfig,
} from "../projectTree";
import {
  type GithubRepoConfig,
  fetchGithubTree,
  resolveGithubToken,
} from "../github";
import { activeProject, projectTreeNodes } from "../../stores";
import { decide } from "./decisions";
import { checkProjectSize, calculateProjectSize } from "../projectDb";
import {
  commitProject,
  flushPendingEditorSave,
  megabytes,
  nowIso,
  resetTreeSelection,
  updateProject,
} from "./core";

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
    const confirmed = await decide().saveTreeStructureOnly({
      limit: megabytes(sizeCheck.limit),
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

/** Сохраняет настройки фильтра выбора файлов дерева (этап 10.6). */
export async function setTreeFilter(filter: TreeFilterSettings): Promise<void> {
  await updateProject((project) => ({ ...project, treeFilter: filter }));
}
