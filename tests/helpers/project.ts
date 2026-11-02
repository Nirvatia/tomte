import { get } from "svelte/store";

import { activeProject } from "../../src/stores";
import type { Project } from "../../src/types";
import type { TreeNode } from "../../src/utils/projectTree";

/**
 * Кладёт дерево в активный проект (создаёт минимальный проект, если его нет).
 * Сторы дерева (projectTreeNodes, projectTreeRootName, projectTreeString)
 * выводятся из активного проекта, поэтому в тестах дерево задаётся только так.
 */
export function setActiveTree(nodes: TreeNode[], rootName = "root"): void {
  const now = new Date().toISOString();
  const current: Project = get(activeProject) ?? {
    id: "test-project",
    name: "Test",
    files: [],
    attachments: [],
    totalSize: 0,
    createdAt: now,
    updatedAt: now,
  };
  activeProject.set({
    ...current,
    projectTreeSource: { rootName, nodes, fileCount: 0 },
  });
}
