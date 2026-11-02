import type { Language, Node, Parser } from "web-tree-sitter";

/** Расширение файла → имя WASM-грамматики в static/wasm. */
const EXT_TO_WASM: Record<string, string> = {
  js: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  jsx: "javascript",
  ts: "typescript",
  mts: "typescript",
  cts: "typescript",
  tsx: "tsx",
  py: "python",
  rs: "rust",
  go: "go",
  java: "java",
  cpp: "cpp",
  cc: "cpp",
  cxx: "cpp",
  c: "cpp",
  h: "cpp",
  hpp: "cpp",
  cs: "c-sharp",
  php: "php",
  rb: "ruby",
  css: "css",
  sh: "bash",
  bash: "bash",
  ps1: "powershell",
  ini: "ini",
  cfg: "ini",
};

/** Есть ли грамматика для этого расширения. */
export function isOutlineSupported(ext: string): boolean {
  return Object.hasOwn(EXT_TO_WASM, ext);
}

type TreeSitterModule = typeof import("web-tree-sitter");

let modulePromise: Promise<TreeSitterModule> | null = null;
let parserPromise: Promise<Parser> | null = null;
const languages = new Map<string, Promise<Language | null>>();

/** web-tree-sitter тяжёлый, поэтому грузим его лениво, при первой карте кода. */
function loadModule(): Promise<TreeSitterModule> {
  modulePromise ??= import("web-tree-sitter");
  return modulePromise;
}

export function initTreeSitter(): Promise<Parser> {
  parserPromise ??= (async () => {
    const { Parser } = await loadModule();
    await Parser.init({ locateFile: () => `/wasm/web-tree-sitter.wasm` });
    return new Parser();
  })();
  // Неудачную инициализацию не кэшируем: следующий вызов попробует снова.
  parserPromise.catch(() => {
    parserPromise = null;
  });
  return parserPromise;
}

export function getLanguage(ext: string): Promise<Language | null> {
  const wasmName = isOutlineSupported(ext) ? EXT_TO_WASM[ext] : undefined;
  if (!wasmName) return Promise.resolve(null);

  let pending = languages.get(wasmName);
  if (!pending) {
    pending = (async () => {
      try {
        await initTreeSitter();
        const { Language } = await loadModule();
        return await Language.load(`/wasm/tree-sitter-${wasmName}.wasm`);
      } catch (err) {
        console.warn(`Failed to load language for ${wasmName}:`, err);
        languages.delete(wasmName);
        return null;
      }
    })();
    languages.set(wasmName, pending);
  }
  return pending;
}

const DECL_TYPES = new Set([
  "function_declaration",
  "function_definition",
  "function_item",
  "class_declaration",
  "class_definition",
  "class_specifier",
  "method_definition",
  "method_declaration",
  "interface_declaration",
  "type_alias_declaration",
  "type_declaration",
  "type_item",
  "enum_declaration",
  "enum_item",
  "struct_item",
  "struct_specifier",
  "struct_declaration",
  "impl_item",
  "trait_item",
]);

const BODY_TYPES = new Set([
  "statement_block",
  "block",
  "class_body",
  "declaration_list",
  "field_declaration_list",
  "object",
  "object_type",
  "body",
]);

const CONTAINER_TYPES = new Set([
  "class_declaration",
  "class_definition",
  "class_specifier",
  "interface_interface",
  "interface_declaration",
  "impl_item",
  "trait_item",
  "struct_item",
  "struct_specifier",
]);

function getSignature(node: Node): string {
  function findBody(n: Node): Node | null {
    for (const child of n.children) {
      if (BODY_TYPES.has(child.type)) return child;
      if (
        child.type === "export_statement" ||
        child.type === "declaration" ||
        child.type === "modifiers"
      ) {
        const found = findBody(child);
        if (found) return found;
      }
    }
    return null;
  }

  const bodyNode = findBody(node);

  let signature = "";
  if (bodyNode) {
    const textBeforeBody = node.text.substring(
      0,
      bodyNode.startIndex - node.startIndex,
    );
    signature = textBeforeBody.trim() + " { ... }";
  } else {
    signature = node.text.trim();
  }

  let isExported = false;
  let current = node.parent;
  while (current) {
    if (current.type === "export_statement") {
      isExported = true;
      break;
    }
    if (DECL_TYPES.has(current.type)) break;
    current = current.parent;
  }

  if (isExported && !signature.startsWith("export")) {
    signature = "export " + signature;
  }

  return signature;
}

function walk(n: Node, results: string[]) {
  if (DECL_TYPES.has(n.type)) {
    const sig = getSignature(n);
    results.push(`L${n.startPosition.row + 1} ${sig}`);

    if (CONTAINER_TYPES.has(n.type)) {
      for (const child of n.children) {
        walk(child, results);
      }
    }
    return;
  }

  for (const child of n.children) {
    walk(child, results);
  }
}

export async function parseFileOutline(
  content: string,
  ext: string,
): Promise<string[]> {
  const p = await initTreeSitter();
  const lang = await getLanguage(ext);
  if (!lang) return [];

  p.setLanguage(lang);
  const tree = p.parse(content);
  if (!tree) return [];

  try {
    const results: string[] = [];
    walk(tree.rootNode, results);
    return results;
  } finally {
    // Дерево живёт в памяти WASM и само не освобождается.
    tree.delete();
  }
}