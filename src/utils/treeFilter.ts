import type { TreeFilterSettings } from "../types";
import { DEFAULT_TREE_FILTER } from "../types";
import type { TreeNode } from "./projectTree";

/**
 * Этап 10.6. Фильтры выбора файлов дерева.
 *
 * Glob-подобные правила в духе .gitignore:
 *  - `*`, `?` внутри сегмента, `**` — через любую глубину каталогов;
 *  - слэш внутри правила — путь от корня дерева (`/src/**`, `doc/*.txt`);
 *  - слэша нет — совпадение по имени на любой глубине (`*.log`);
 *  - концевой слэш — каталог и всё его содержимое (`node_modules/`);
 *  - `!` — отмена правила; при конфликте побеждает последнее совпавшее.
 *
 * Упрощение относительно gitignore: отмена (`!`) не воскрешает файлы
 * внутри отсечённого каталога, если сам каталог не возвращён правилом.
 * Для фильтра выбора это приемлемо: правила читаются сверху вниз.
 */

export type FilterDecision = "exclude" | "include";
export type PathMatcher = (
  path: string,
  isDir: boolean,
) => FilterDecision | null;

/** Пресеты фильтра: id → правила. */
export const FILTER_PRESETS: Record<string, string[]> = {
  "only-src": ["*", "!/src/", "!/src/**"],
  "no-tests": [
    "**/__tests__/**",
    "**/test/**",
    "**/tests/**",
    "**/*.test.*",
    "**/*.spec.*",
  ],
  "code-only": [
    "**/*.png",
    "**/*.jpg",
    "**/*.jpeg",
    "**/*.gif",
    "**/*.webp",
    "**/*.ico",
    "**/*.woff",
    "**/*.woff2",
    "**/*.ttf",
    "**/*.eot",
    "**/*.pdf",
    "**/*.zip",
    "**/*.gz",
    "**/*.tar",
    "**/*.map",
    "**/*.min.js",
    "**/*.min.css",
    "**/package-lock.json",
    "**/yarn.lock",
    "**/pnpm-lock.yaml",
  ],
};

function escapeRegExp(char: string): string {
  return char.replace(/[.+^${}()|[\]\\]/g, "\\$&");
}

/** Glob → тело регулярки, сопоставляемое с целым путём. */
function globToRegexSource(glob: string): string {
  let source = "";
  let i = 0;
  while (i < glob.length) {
    const char = glob[i];
    if (char === "*") {
      if (glob[i + 1] === "*") {
        source += ".*";
        i += 2;
        // «**/» может означать и ноль каталогов: «src/**» = «src/» + любой хвост.
        if (glob[i] === "/") i += 1;
      } else {
        source += "[^/]*";
        i += 1;
      }
    } else if (char === "?") {
      source += "[^/]";
      i += 1;
    } else {
      source += escapeRegExp(char);
      i += 1;
    }
  }
  return source;
}

type CompiledRule = {
  negate: boolean;
  test: (path: string) => boolean;
};

function compileRule(raw: string): CompiledRule | null {
  let rule = raw.trim();
  if (!rule || rule.startsWith("#")) return null;

  let negate = false;
  if (rule.startsWith("!")) {
    negate = true;
    rule = rule.slice(1);
  }

  let dirOnly = false;
  if (rule.endsWith("/")) {
    dirOnly = true;
    rule = rule.slice(0, -1);
  }
  if (!rule) return null;

  const anchored = rule.startsWith("/");
  if (anchored) rule = rule.slice(1);
  const hasSlash = rule.includes("/");
  const body = globToRegexSource(rule);

  let test: (path: string) => boolean;
  if (dirOnly) {
    // Каталог и всё содержимое: на любой глубине, если слэша не было.
    const source =
      hasSlash || anchored ? `^${body}(/.*)?$` : `(^|.*/)${body}(/.*)?$`;
    const re = new RegExp(source);
    test = (path) => re.test(path);
  } else if (hasSlash || anchored) {
    const re = new RegExp(`^${body}$`);
    test = (path) => re.test(path);
  } else {
    // Имя на любой глубине.
    const re = new RegExp(`(^|/)${body}$`);
    test = (path) => re.test(path);
  }

  return { negate, test };
}

/** Разбор .gitignore: строки-правила, пустые и комментарии отброшены. */
export function parseGitignore(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
}

/** Компилирует упорядоченные правила: последнее совпавшее побеждает. */
export function compilePatterns(patterns: string[]): PathMatcher {
  const rules = patterns
    .map(compileRule)
    .filter((rule): rule is CompiledRule => rule !== null);
  return (path, _isDir) => {
    let decision: FilterDecision | null = null;
    for (const rule of rules) {
      if (rule.test(path)) {
        decision = rule.negate ? "include" : "exclude";
      }
    }
    return decision;
  };
}

/**
 * Собирает матчер из настроек проекта: пресеты, свои правила и (опцией)
 * .gitignore. Настройки отсутствуют — все файлы проходят.
 */
export function buildTreeMatcher(
  settings: TreeFilterSettings | undefined,
  gitignorePatterns: string[],
): PathMatcher {
  // Настройки ещё не сохранялись — действует фильтр по умолчанию (.gitignore).
  const effective = settings ?? DEFAULT_TREE_FILTER;
  const patterns: string[] = [];
  for (const preset of effective.presets) {
    patterns.push(...(FILTER_PRESETS[preset] ?? []));
  }
  patterns.push(...effective.custom);
  if (effective.useGitignore) patterns.push(...gitignorePatterns);
  if (patterns.length === 0) return () => null;
  return compilePatterns(patterns);
}

/** Пути файлов, отсеянные матчером. */
export function collectFilteredPaths(
  nodes: TreeNode[],
  matcher: PathMatcher,
): Set<string> {
  const excluded = new Set<string>();
  const walk = (items: TreeNode[]) => {
    for (const item of items) {
      if (item.type === "file") {
        if (matcher(item.path, false) === "exclude") excluded.add(item.path);
      } else {
        walk(item.children);
      }
    }
  };
  walk(nodes);
  return excluded;
}

/** Фильтрует отмеченные пути: отсеянные не должны уходить в экспорт и токены. */
export function excludeFilteredPaths(
  paths: string[],
  filtered: ReadonlySet<string>,
): string[] {
  if (filtered.size === 0) return paths;
  return paths.filter((path) => !filtered.has(path));
}
