import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import svelte from "eslint-plugin-svelte";
import globals from "globals";
import ts from "typescript-eslint";

import svelteConfig from "./svelte.config.js";

export default ts.config(
  {
    ignores: [
      ".svelte-kit/",
      "build/",
      "node_modules/",
      "static/",
      "test-results/",
      "playwright-report/",
      "reports/",
    ],
  },
  js.configs.recommended,
  ...ts.configs.recommended,
  ...svelte.configs.recommended,
  prettier,
  ...svelte.configs.prettier,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      // Сторы обновляются неизменяемо (new Set(old) → set), локальные Set/Map
      // внутри функций реактивными быть не должны. Правило тут даёт только ложные срабатывания.
      "svelte/prefer-svelte-reactivity": "off",
      // Неиспользуемое с префиксом _ — осознанно (деструктуризация, чтобы выкинуть поле).
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
        },
      ],
    },
  },
  {
    files: ["**/*.svelte", "**/*.svelte.ts", "**/*.svelte.js"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        extraFileExtensions: [".svelte"],
        parser: ts.parser,
        svelteConfig,
      },
    },
  },
  {
    // В тестах моки и фикстуры часто проще типизировать как any.
    files: ["tests/**"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
);
