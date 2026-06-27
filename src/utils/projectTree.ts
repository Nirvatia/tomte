export interface TreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children: TreeNode[];
}

export interface TreeStats {
  totalFiles: number;
  totalDirs: number;
  rootName: string;
}

// Директории, которые обычно не нужны в дереве
const DEFAULT_IGNORE = [
  'node_modules',
  '.git',
  '.next',
  '.nuxt',
  'dist',
  'build',
  '.svelte-kit',
  '.turbo',
  '.cache',
  '__pycache__',
  '.venv',
  'venv',
  '.idea',
  '.vscode',
  'target',
  '.DS_Store',
  'coverage',
  '.nyc_output',
];

export async function readDirectoryRecursive(
  dirHandle: FileSystemDirectoryHandle,
  path: string = '',
  ignore: string[] = DEFAULT_IGNORE
): Promise<TreeNode[]> {
  const nodes: TreeNode[] = [];

  for await (const entry of (dirHandle as any).values()) {
    if (ignore.includes(entry.name)) continue;
    if (entry.name.startsWith('.') && entry.kind === 'directory') continue;

    const entryPath = path ? `${path}/${entry.name}` : entry.name;

    if (entry.kind === 'directory') {
      const children = await readDirectoryRecursive(entry, entryPath, ignore);
      nodes.push({
        name: entry.name,
        path: entryPath,
        type: 'directory',
        children,
      });
    } else {
      nodes.push({
        name: entry.name,
        path: entryPath,
        type: 'file',
        children: [],
      });
    }
  }

  // Сортировка: папки первыми, затем файлы, по алфавиту
  nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return nodes;
}

export function treeToText(
  nodes: TreeNode[],
  prefix: string = '',
  isLast: boolean = true,
  isRoot: boolean = true
): string {
  let result = '';

  nodes.forEach((node, index) => {
    const isLastItem = index === nodes.length - 1;
    const connector = isRoot ? '' : isLastItem ? '└── ' : '├── ';
    const childPrefix = isRoot ? '' : prefix + (isLastItem ? '    ' : '│   ');

    result += prefix + connector + node.name + '\n';

    if (node.type === 'directory' && node.children.length > 0) {
      result += treeToText(node.children, childPrefix, isLastItem, false);
    }
  });

  return result;
}

export function buildTreeString(rootName: string, nodes: TreeNode[]): string {
  const header = `${rootName}/\n`;
  const tree = treeToText(nodes, '', true, true);
  return header + tree;
}

export function calculateStats(nodes: TreeNode[]): TreeStats {
  let totalFiles = 0;
  let totalDirs = 0;

  function traverse(items: TreeNode[]) {
    for (const item of items) {
      if (item.type === 'file') totalFiles++;
      else {
        totalDirs++;
        traverse(item.children);
      }
    }
  }

  traverse(nodes);
  return { totalFiles, totalDirs, rootName: '' };
}

export async function readDirectoryViaInput(
  files: FileList,
  ignore: string[] = DEFAULT_IGNORE
): Promise<{ nodes: TreeNode[]; rootName: string }> {
  const root: TreeNode = {
    name: 'root',
    path: '',
    type: 'directory',
    children: [],
  };

  const fileArray = Array.from(files);
  if (fileArray.length === 0) return { nodes: [], rootName: 'root' };

  const firstPath = (fileArray[0] as any).webkitRelativePath || fileArray[0].name;
  const rootName = firstPath.split('/')[0];
  root.name = rootName;

  for (const file of fileArray) {
    const relativePath = (file as any).webkitRelativePath || file.name;
    const parts = relativePath.split('/').slice(1); // убираем корень

    // Фильтруем файлы, путь которых содержит игнорируемые сегменты
    const shouldIgnore = parts.some((part: any) => {
      if (ignore.includes(part)) return true;
      if (part.startsWith('.') && part !== '.') return true;
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
          path: parts.slice(0, i + 1).join('/'),
          type: isFile ? 'file' : 'directory',
          children: [],
        };
        current.children.push(child);
      }
      current = child;
    }
  }

  // Сортировка + удаление пустых папок
  function sortAndClean(items: TreeNode[]): TreeNode[] {
    // Сортируем
    items.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    // Рекурсивно обрабатываем детей и удаляем пустые папки
    const filtered: TreeNode[] = [];
    for (const item of items) {
      if (item.type === 'directory') {
        item.children = sortAndClean(item.children);
        if (item.children.length > 0) {
          filtered.push(item);
        }
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
  // Проверка на наличие window для SSR
  if (typeof window === 'undefined') return false;
  return 'showDirectoryPicker' in window;
}