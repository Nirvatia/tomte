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

/** Узлы, которые попадают в карту: функции, методы, классы, типы. */
const DECL_TYPES = new Set([
  // JS/TS
  "function_declaration",
  "generator_function_declaration",
  "class_declaration",
  "abstract_class_declaration",
  "method_definition",
  "interface_declaration",
  "type_alias_declaration",
  "enum_declaration",
  // Python, C/C++, PHP
  "function_definition",
  "class_definition",
  "class_specifier",
  "struct_specifier",
  "namespace_definition",
  "template_declaration",
  // Java, C#, Go, PHP
  "method_declaration",
  "constructor_declaration",
  "type_declaration",
  "struct_declaration",
  "record_declaration",
  // Rust
  "function_item",
  "struct_item",
  "enum_item",
  "type_item",
  "impl_item",
  "trait_item",
  // Ruby
  "method",
  "singleton_method",
  "class",
  "module",
  // PowerShell
  "function_statement",
  // CSS: селекторы правил; INI: секции
  "rule_set",
  "section",
]);

/** Внутрь этих узлов заходим, чтобы показать методы и вложенные типы. */
const CONTAINER_TYPES = new Set([
  "class_declaration",
  "abstract_class_declaration",
  "class_definition",
  "class_specifier",
  "struct_specifier",
  "namespace_definition",
  "interface_declaration",
  "struct_declaration",
  "record_declaration",
  "impl_item",
  "trait_item",
  "class",
  "module",
]);

/** Тела, которые прячем за «...». */
const BODY_TYPES = new Set([
  "statement_block",
  "block",
  "class_body",
  "declaration_list",
  "field_declaration_list",
  "enum_body",
  "object_type",
  "interface_body",
  "compound_statement",
  "body_statement",
  "script_block",
  "body",
]);

/** Прототипы C/C++: «int f(int a);» и методы, объявленные внутри класса. */
const PROTOTYPE_TYPES = new Set(["declaration", "field_declaration"]);

/** Узлы-обёртки, внутри которых может лежать тело (export, template, модификаторы). */
const BODY_WRAPPERS = new Set([
  "export_statement",
  "declaration",
  "modifiers",
  "function_definition",
  "class_specifier",
  "struct_specifier",
]);

const MAX_SIGNATURE_LENGTH = 200;

function findBody(node: Node, depth = 0): Node | null {
  const byField = node.childForFieldName("body");
  if (byField) return byField;
  for (const child of node.children) {
    if (BODY_TYPES.has(child.type)) return child;
    if (depth < 2 && BODY_WRAPPERS.has(child.type)) {
      const found = findBody(child, depth + 1);
      if (found) return found;
    }
  }
  return null;
}

/** Как показать спрятанное тело: зависит от того, как язык оформляет блоки. */
function bodyMarker(body: Node, head: string): string {
  if (body.type === "block" && head.endsWith(":")) return " ..."; // Python
  if (body.type === "body_statement") return ""; // Ruby: «def m(x)» достаточно
  return " { ... }";
}

function oneLine(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > MAX_SIGNATURE_LENGTH
    ? flat.slice(0, MAX_SIGNATURE_LENGTH - 1) + "…"
    : flat;
}

function isExported(node: Node): boolean {
  for (let current = node.parent; current; current = current.parent) {
    if (current.type === "export_statement") return true;
    if (DECL_TYPES.has(current.type)) return false;
  }
  return false;
}

function getSignature(node: Node): string {
  // INI: секция — это её заголовок «[name]», настройки под ним не нужны.
  if (node.type === "section") return oneLine(node.text.split("\n")[0]);
  const body = findBody(node);
  let signature: string;
  if (body) {
    // Открывающая скобка иногда остаётся в заголовке (PowerShell: тело внутри «{»).
    const head = node.text
      .slice(0, body.startIndex - node.startIndex)
      .trim()
      .replace(/\{$/, "")
      .trim();
    signature = oneLine(head) + bodyMarker(body, head);
  } else {
    signature = oneLine(node.text);
  }
  if (isExported(node) && !signature.startsWith("export")) {
    signature = "export " + signature;
  }
  return signature;
}

/** declaration/field_declaration, объявляющие функцию (а не переменную). */
function isPrototype(node: Node): boolean {
  if (!PROTOTYPE_TYPES.has(node.type)) return false;
  const declarator = node.childForFieldName("declarator");
  return declarator?.type === "function_declarator";
}

function walk(n: Node, results: string[]) {
  // Корень файла объявлением не бывает: у Python он называется module,
  // как модуль в Ruby.
  if (n.parent && DECL_TYPES.has(n.type)) {
    results.push(`L${n.startPosition.row + 1} ${getSignature(n)}`);
    if (CONTAINER_TYPES.has(n.type)) {
      const body = findBody(n);
      for (const child of (body ?? n).children) walk(child, results);
    }
    return;
  }
  if (isPrototype(n)) {
    results.push(`L${n.startPosition.row + 1} ${oneLine(n.text)}`);
    return;
  }
  for (const child of n.children) walk(child, results);
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
