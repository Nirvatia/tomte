let parser: any = null;
let parserModule: any = null; // Сохраняем весь модуль для доступа к Language
const languages = new Map<string, any>();

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

let ParserClass: any = null;

async function getParserClass(): Promise<any> {
  if (ParserClass) return ParserClass;
  
  const mod = await import("web-tree-sitter");
  parserModule = mod; // Сохраняем модуль
  
  ParserClass = mod.default || mod.Parser || mod;
  
  if (!ParserClass || typeof ParserClass.init !== "function") {
    console.error("web-tree-sitter module structure:", mod);
    throw new Error("Failed to load web-tree-sitter Parser");
  }
  
  return ParserClass;
}

export async function initTreeSitter(): Promise<any> {
  if (parser) return parser;
  
  const Parser = await getParserClass();
  await Parser.init({
    locateFile: () => `/wasm/web-tree-sitter.wasm`,
  });
  
  parser = new Parser();
  return parser;
}

export async function getLanguage(ext: string): Promise<any> {
  const wasmName = EXT_TO_WASM[ext];
  if (!wasmName) return null;

  if (languages.has(wasmName)) {
    return languages.get(wasmName)!;
  }

  try {
    const Parser = await getParserClass();
    await initTreeSitter();

    // Ищем Language во всех возможных местах (Parser.Language, модуль, дефолтный экспорт)
    const LanguageClass = 
      Parser.Language || 
      (parserModule && parserModule.Language) || 
      (Parser.default && Parser.default.Language);

    if (!LanguageClass || typeof LanguageClass.load !== "function") {
      console.error("Parser structure during language load:", { Parser, parserModule });
      throw new Error("Parser.Language is not available");
    }

    const lang = await LanguageClass.load(
      `/wasm/tree-sitter-${wasmName}.wasm`,
    );
    languages.set(wasmName, lang);
    return lang;
  } catch (err) {
    console.warn(`Failed to load language for ${wasmName}:`, err);
    return null;
  }
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

function getSignature(node: any): string {
  let bodyNode: any = null;

  function findBody(n: any): any {
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

  bodyNode = findBody(node);

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

function walk(n: any, results: string[]) {
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

  const results: string[] = [];
  walk(tree.rootNode, results);
  return results;
}