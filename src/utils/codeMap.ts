import type { TreeNode } from "./projectTree";
import { fetchGithubFileContent } from "./github";
import { isOutlineSupported, parseFileOutline } from "./treeSitter";

export interface CodeMapResult {
  text: string;
  /** Файлы, по которым есть сигнатуры. */
  parsed: number;
  /** Файлы без содержимого: дерево сохранено только структурой. */
  noContent: string[];
  /** Файлы, которые не удалось прочитать или разобрать. */
  failed: string[];
}

async function readFileContent(node: TreeNode): Promise<string | null> {
  if (node.fileRef) {
    const file =
      node.fileRef instanceof File
        ? node.fileRef
        : await (node.fileRef as FileSystemFileHandle).getFile();
    return file.text();
  }
  if (node.githubRef) {
    return (await fetchGithubFileContent(node)).content;
  }
  return null;
}

const COMPONENT_EXTENSIONS = new Set(["svelte", "vue"]);

/**
 * Код из <script> однофайловых компонентов (.svelte, .vue): разбираем его
 * как TS или JS и сдвигаем номера строк, чтобы они совпадали с файлом.
 */
async function componentOutline(content: string): Promise<string[]> {
  const results: string[] = [];
  const scriptRe = /<script\b([^>]*)>([\s\S]*?)<\/script>/g;
  for (const match of content.matchAll(scriptRe)) {
    const attrs = match[1];
    const ext = /lang=["']ts["']/.test(attrs) ? "ts" : "js";
    const lineOffset =
      content.slice(0, match.index! + match[0].indexOf(">") + 1).split("\n")
        .length - 1;
    for (const line of await parseFileOutline(match[2], ext)) {
      results.push(
        line.replace(/^L(\d+)/, (_, n) => `L${Number(n) + lineOffset}`),
      );
    }
  }
  return results;
}

function extensionOf(name: string): string {
  return name.split(".").pop()?.toLowerCase() || "";
}

/** Можно ли построить карту для файла (по расширению). */
export function canOutline(name: string): boolean {
  const ext = extensionOf(name);
  return COMPONENT_EXTENSIONS.has(ext) || isOutlineSupported(ext);
}

/**
 * Карта кода: сигнатуры функций, классов и типов по папке.
 * Папки без единой сигнатуры не выводятся, пропущенные файлы перечисляются в результате.
 */
export async function generateCodeMap(
  rootNode: TreeNode,
): Promise<CodeMapResult> {
  const result: CodeMapResult = {
    text: "",
    parsed: 0,
    noContent: [],
    failed: [],
  };

  async function processNode(
    node: TreeNode,
    indent: string,
  ): Promise<string[]> {
    if (node.type === "directory") {
      const inner: string[] = [];
      for (const child of node.children) {
        inner.push(...(await processNode(child, indent + "  ")));
      }
      return inner.length > 0 ? [`${indent}${node.name}/`, ...inner] : [];
    }

    if (!canOutline(node.name)) return [];
    const ext = extensionOf(node.name);
    try {
      const content = await readFileContent(node);
      if (content === null) {
        result.noContent.push(node.path);
        return [];
      }
      const outline = COMPONENT_EXTENSIONS.has(ext)
        ? await componentOutline(content)
        : await parseFileOutline(content, ext);
      if (outline.length === 0) return [];
      result.parsed += 1;
      return [
        `${indent}${node.name}:`,
        ...outline.map((line) => `${indent}  ${line}`),
      ];
    } catch (err) {
      console.warn(`Error parsing ${node.path}:`, err);
      result.failed.push(node.path);
      return [];
    }
  }

  result.text = (await processNode(rootNode, "")).join("\n");
  return result;
}
