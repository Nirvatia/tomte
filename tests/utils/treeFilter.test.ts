import { describe, it, expect } from "vitest";

import type { TreeNode } from "../../src/utils/projectTree";
import {
  buildTreeMatcher,
  collectFilteredPaths,
  compilePatterns,
  excludeFilteredPaths,
  parseGitignore,
  FILTER_PRESETS,
} from "../../src/utils/treeFilter";
import { DEFAULT_TREE_FILTER } from "../../src/types";

const file = (path: string): TreeNode => ({
  name: path.split("/").pop()!,
  path,
  type: "file",
  children: [],
});

function tree(paths: string[]): TreeNode[] {
  // Плоский список для тестов матчера: каталоги не нужны.
  return paths.map(file);
}

describe("treeFilter (10.6)", () => {
  it("паттерн без слэша совпадает по имени на любой глубине", () => {
    const match = compilePatterns(["*.log"]);
    expect(match("debug.log", false)).toBe("exclude");
    expect(match("a/b/c.log", false)).toBe("exclude");
    expect(match("a/blog.txt", false)).toBeNull();
    expect(match("a/blog", false)).toBeNull();
  });

  it("паттерн со слэшем привязан к корню", () => {
    const match = compilePatterns(["src/**"]);
    expect(match("src/index.ts", false)).toBe("exclude");
    expect(match("lib/src/index.ts", false)).toBeNull();
  });

  it("концевой слэш — каталог и всё содержимое, на любой глубине", () => {
    const match = compilePatterns(["node_modules/"]);
    expect(match("node_modules/pkg/index.js", false)).toBe("exclude");
    expect(match("node_modules", true)).toBe("exclude");
    expect(match("node_modulesx/a.js", false)).toBeNull();
  });

  it("отмена ! перекрывает предыдущее правило", () => {
    const match = compilePatterns(["**/*.ts", "!src/**/*.ts"]);
    expect(match("a/b.ts", false)).toBe("exclude");
    expect(match("src/b.ts", false)).toBe("include");
  });

  it("последнее совпавшее правило побеждает", () => {
    const match = compilePatterns(["!src/**", "src/generated/**"]);
    expect(match("src/a.ts", false)).toBe("include");
    expect(match("src/generated/a.ts", false)).toBe("exclude");
  });

  it("? заменяет один символ", () => {
    const match = compilePatterns(["src/file?.ts"]);
    expect(match("src/file1.ts", false)).toBe("exclude");
    expect(match("src/file.ts", false)).toBeNull();
    expect(match("src/file12.ts", false)).toBeNull();
  });

  it("парсит .gitignore: комментарии и пустые строки отброшены", () => {
    expect(parseGitignore("# комментарий\n\nnode_modules/\n*.log\n")).toEqual([
      "node_modules/",
      "*.log",
    ]);
  });

  it("пресет only-src оставляет только src/", () => {
    const matcher = buildTreeMatcher(
      { useGitignore: false, presets: ["only-src"], custom: [] },
      [],
    );
    const excluded = collectFilteredPaths(
      tree(["src/index.ts", "README.md", "docs/a.md", "src/nested/b.ts"]),
      matcher,
    );
    expect(excluded).toEqual(new Set(["README.md", "docs/a.md"]));
  });

  it("пресет no-tests отсеивает тесты на любой глубине", () => {
    const matcher = buildTreeMatcher(
      { useGitignore: false, presets: ["no-tests"], custom: [] },
      [],
    );
    const excluded = collectFilteredPaths(
      tree(["src/app.test.ts", "src/__tests__/x.ts", "src/app.ts"]),
      matcher,
    );
    expect(excluded).toEqual(
      new Set(["src/app.test.ts", "src/__tests__/x.ts"]),
    );
  });

  it(".gitignore учитывается опцией", () => {
    const gitignore = ["dist/"];
    const settings = { ...DEFAULT_TREE_FILTER, presets: [] };
    const withGi = buildTreeMatcher(settings, gitignore);
    const withoutGi = buildTreeMatcher(
      { ...settings, useGitignore: false },
      gitignore,
    );
    expect(
      collectFilteredPaths(tree(["dist/bundle.js", "src/a.ts"]), withGi),
    ).toEqual(new Set(["dist/bundle.js"]));
    expect(
      collectFilteredPaths(tree(["dist/bundle.js", "src/a.ts"]), withoutGi),
    ).toEqual(new Set());
  });

  it("пресеты известны всем трём id", () => {
    expect(Object.keys(FILTER_PRESETS)).toEqual([
      "only-src",
      "no-tests",
      "code-only",
    ]);
  });

  it("excludeFilteredPaths убирает отсеянные из выбранных", () => {
    const filtered = new Set(["b.ts"]);
    expect(excludeFilteredPaths(["a.ts", "b.ts"], filtered)).toEqual(["a.ts"]);
    expect(excludeFilteredPaths(["a.ts"], new Set())).toEqual(["a.ts"]);
  });
});
