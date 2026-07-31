import type { AttachedFile } from "../types";

export interface TreeNode {
  name: string;
  path: string;
  type: "file" | "directory";
  children: TreeNode[];
  fileRef?: File | FileSystemFileHandle; // <-- Ссылка на файл, читаем только по запросу
}

export interface TreeStats {
  totalFiles: number;
  totalDirs: number;
  rootName: string;
}

const DEFAULT_IGNORE = [
  "node_modules",
  ".git",
  ".next",
  ".nuxt",
  "dist",
  "build",
  ".svelte-kit",
  ".turbo",
  ".cache",
  "__pycache__",
  ".venv",
  "venv",
  ".idea",
  ".vscode",
  "target",
  ".DS_Store",
  "coverage",
  ".nyc_output",
];

export async function readDirectoryRecursive(
  dirHandle: FileSystemDirectoryHandle,
  path: string = "",
  ignore: string[] = DEFAULT_IGNORE,
): Promise<TreeNode[]> {
  const nodes: TreeNode[] = [];

  for await (const entry of (dirHandle as any).values()) {
    if (ignore.includes(entry.name)) continue;
    if (entry.name.startsWith(".") && entry.kind === "directory") continue;

    const entryPath = path ? `${path}/${entry.name}` : entry.name;

    if (entry.kind === "directory") {
      const children = await readDirectoryRecursive(entry, entryPath, ignore);
      nodes.push({
        name: entry.name,
        path: entryPath,
        type: "directory",
        children,
      });
    } else {
      nodes.push({
        name: entry.name,
        path: entryPath,
        type: "file",
        children: [],
        fileRef: entry as FileSystemFileHandle, // <-- Сохраняем ссылку, НЕ читаем содержимое
      });
    }
  }

  nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return nodes;
}

export function treeToText(
  nodes: TreeNode[],
  prefix = "",
  isLast = true,
  isRoot = true,
): string {
  let result = "";
  nodes.forEach((node, index) => {
    const isLastItem = index === nodes.length - 1;
    const connector = isRoot ? "" : isLastItem ? "└── " : "├── ";
    const childPrefix = isRoot ? "" : prefix + (isLastItem ? "    " : "│   ");
    result += prefix + connector + node.name + "\n";
    if (node.type === "directory" && node.children.length > 0) {
      result += treeToText(node.children, childPrefix, isLastItem, false);
    }
  });
  return result;
}

export function buildTreeString(rootName: string, nodes: TreeNode[]): string {
  return `${rootName}/\n` + treeToText(nodes, "", true, true);
}

export function calculateStats(nodes: TreeNode[]): TreeStats {
  let totalFiles = 0;
  let totalDirs = 0;
  function traverse(items: TreeNode[]) {
    for (const item of items) {
      if (item.type === "file") totalFiles++;
      else {
        totalDirs++;
        traverse(item.children);
      }
    }
  }
  traverse(nodes);
  return { totalFiles, totalDirs, rootName: "" };
}

export async function readDirectoryViaInput(
  files: FileList,
  ignore: string[] = DEFAULT_IGNORE,
): Promise<{ nodes: TreeNode[]; rootName: string }> {
  const root: TreeNode = {
    name: "root",
    path: "",
    type: "directory",
    children: [],
  };
  const fileArray = Array.from(files);
  if (fileArray.length === 0) return { nodes: [], rootName: "root" };

  const rootName = (
    (fileArray[0] as any).webkitRelativePath || fileArray[0].name
  ).split("/")[0];
  root.name = rootName;

  for (const file of fileArray) {
    const relativePath = (file as any).webkitRelativePath || file.name;
    const parts = relativePath.split("/").slice(1);

    const shouldIgnore = parts.some((part: string) => {
      if (ignore.includes(part)) return true;
      if (part.startsWith(".") && part !== ".") return true;
      return false;
    });
    if (shouldIgnore) continue;

    let current = root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isFile = i === parts.length - 1;
      let child = current.children.find((c) => c.name === part);

      if (!child) {
        child = {
          name: part,
          path: parts.slice(0, i + 1).join("/"),
          type: isFile ? "file" : "directory",
          children: [],
          fileRef: isFile ? file : undefined, // <-- Сохраняем File объект, НЕ читаем содержимое
        };
        current.children.push(child);
      }
      current = child;
    }
  }

  function sortAndClean(items: TreeNode[]): TreeNode[] {
    items.sort((a, b) => {
      if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    const filtered: TreeNode[] = [];
    for (const item of items) {
      if (item.type === "directory") {
        item.children = sortAndClean(item.children);
        if (item.children.length > 0) filtered.push(item);
      } else {
        filtered.push(item);
      }
    }
    return filtered;
  }

  root.children = sortAndClean(root.children);
  return { nodes: root.children, rootName };
}

export function hasFileSystemAccess(): boolean {
  if (typeof window === "undefined") return false;
  return "showDirectoryPicker" in window;
}

// ==========================================
// ЧТЕНИЕ ВЫБРАННЫХ ФАЙЛОВ ТОЛЬКО ПРИ ЭКСПОРТЕ
// ==========================================
export async function getSelectedTreeFilesAsAttachments(
  nodes: TreeNode[],
  selectedPaths: string[],
): Promise<AttachedFile[]> {
  const selectedSet = new Set(selectedPaths);
  const fileNodes: TreeNode[] = [];

  // 1. Собираем только выбранные файлы
  function collect(items: TreeNode[]) {
    for (const item of items) {
      if (item.type === "file" && selectedSet.has(item.path) && item.fileRef) {
        fileNodes.push(item);
      } else if (item.type === "directory") {
        collect(item.children);
      }
    }
  }
  collect(nodes);

  if (fileNodes.length === 0) return [];

  // 2. Явно указываем, что Promise возвращает AttachedFile или null
  const promises = fileNodes.map(async (node): Promise<AttachedFile | null> => {
    try {
      let content = "";
      let size = 0;

      if (node.fileRef instanceof File) {
        content = await node.fileRef.text();
        size = node.fileRef.size;
      } else {
        const file = await (node.fileRef as FileSystemFileHandle).getFile();
        content = await file.text();
        size = file.size;
      }

      // 3. Явно приводим объект к типу AttachedFile и используем 'as const' для type
      return {
        id: node.path,
        name: node.path,
        size,
        type: "text" as const, // <-- КРИТИЧЕСКИ ВАЖНО: as const
        content,
        includeInExport: true,
      } as AttachedFile;
    } catch (e) {
      console.warn(`Не удалось прочитать ${node.path}`);
      return null;
    }
  });

  const results = await Promise.all(promises);

  // 4. Теперь TypeScript точно знает, что фильтрует массив (AttachedFile | null)[]
  return results.filter((f): f is AttachedFile => f !== null);
}
