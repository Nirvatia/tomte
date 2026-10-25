// scripts/check-wasm-compat.mjs
// Запуск: node scripts/check-wasm-compat.mjs
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

async function main() {
  const { Parser, Language } = await import("web-tree-sitter");

  const corePath = [
    resolve(
      process.cwd(),
      "node_modules",
      "web-tree-sitter",
      "web-tree-sitter.wasm",
    ),
    resolve(process.cwd(), "static", "wasm", "web-tree-sitter.wasm"),
  ].find(existsSync);

  const tsPath = [
    resolve(
      process.cwd(),
      "node_modules",
      "@vscode/tree-sitter-wasm",
      "wasm",
      "tree-sitter-typescript.wasm",
    ),
    resolve(process.cwd(), "static", "wasm", "tree-sitter-typescript.wasm"),
  ].find(existsSync);

  if (!corePath) throw new Error("web-tree-sitter.wasm не найден");
  if (!tsPath) throw new Error("tree-sitter-typescript.wasm не найден");

  console.log("Ядро:      ", corePath);
  console.log("Грамматика:", tsPath);

  const coreBytes = await readFile(corePath);
  const langBytes = await readFile(tsPath);

  await Parser.init({
    locateFile: () => corePath,
  });

  const parser = new Parser();
  const lang = await Language.load(langBytes);
  parser.setLanguage(lang);

  const tree = parser.parse("function hello(name: string): void {}");
  const rootType = tree.rootNode.type;

  if (rootType === "program" && tree.rootNode.childCount > 0) {
    console.log("\n✅ СОВМЕСТИМО. Ядро и грамматика работают вместе.");
    console.log(
      "   Корень AST:",
      rootType,
      "| детей:",
      tree.rootNode.childCount,
    );
  } else {
    console.log("\n⚠️ Загрузилось, но AST подозрительный:", rootType);
  }
}

main().catch((err) => {
  console.error("\n❌ НЕСОВМЕСТИМО или ошибка загрузки:");
  console.error("  ", err.message || err);
  process.exit(1);
});
