import { test, expect } from "@playwright/test";

/**
 * Карта кода на настоящих WASM-грамматиках tree-sitter (в браузере).
 * Модули берём прямо с dev-сервера Vite.
 */
/**
 * Импорт модуля приложения внутри page.evaluate: код выполняется в браузере
 * на dev-сервере, поэтому путь передаём строкой, а тип берём из исходника.
 */
type TreeSitterModule = typeof import("../../src/utils/treeSitter");
type ActionsModule = typeof import("../../src/utils/projectActions");
type StoresModule = typeof import("../../src/stores");

const CASES: Record<string, { code: string; expected: string[] }> = {
  ts: {
    code: "export function a(x: number): string { return ''; }\nclass B { m() {} }",
    expected: [
      "L1 export function a(x: number): string { ... }",
      "L2 class B { ... }",
      "L2 m() { ... }",
    ],
  },
  py: {
    code: "def f(x):\n    return x\n\nclass A:\n    def m(self):\n        pass\n",
    expected: ["L1 def f(x): ...", "L4 class A: ...", "L5 def m(self): ..."],
  },
  cpp: {
    code: "int add(int a, int b) { return a + b; }\nclass Foo { public: void bar(); };",
    expected: [
      "L1 int add(int a, int b) { ... }",
      "L2 class Foo { ... }",
      "L2 void bar();",
    ],
  },
  h: {
    code: "struct S { int x; };\nint f(int a);",
    expected: ["L1 struct S { ... }", "L2 int f(int a);"],
  },
  php: {
    code: "<?php\nfunction f($a) { return $a; }\nclass A { public function m() { return 1; } }",
    expected: [
      "L2 function f($a) { ... }",
      "L3 class A { ... }",
      "L3 public function m() { ... }",
    ],
  },
  rb: {
    code: "class A\n  def m(x)\n    x\n  end\nend",
    expected: ["L1 class A", "L2 def m(x)"],
  },
  go: {
    code: "package main\nfunc Hello(name string) string { return name }",
    expected: ["L2 func Hello(name string) string { ... }"],
  },
  rs: {
    code: "pub fn add(a: i32) -> i32 { a }\nimpl S { fn m(&self) {} }",
    expected: [
      "L1 pub fn add(a: i32) -> i32 { ... }",
      "L2 impl S { ... }",
      "L2 fn m(&self) { ... }",
    ],
  },
  java: {
    code: "public class A { public void m() {} }",
    expected: ["L1 public class A { ... }", "L1 public void m() { ... }"],
  },
  ps1: {
    code: 'function Get-Hi { "hi" }',
    expected: ["L1 function Get-Hi { ... }"],
  },
  css: {
    code: ".a, .b:hover { color: red; }",
    expected: ["L1 .a, .b:hover { ... }"],
  },
};

test.describe("Карта кода", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("tab").first()).toBeVisible({
      timeout: 15_000,
    });
  });

  for (const [ext, { code, expected }] of Object.entries(CASES)) {
    test(`сигнатуры: .${ext}`, async ({ page }) => {
      const outline = await page.evaluate(
        async ({ code, ext, path }) => {
          const m: TreeSitterModule = await import(/* @vite-ignore */ path);
          return m.parseFileOutline(code, ext);
        },
        { code, ext, path: "/src/utils/treeSitter.ts" },
      );
      expect(outline).toEqual(expected);
    });
  }

  test("из интерфейса: .py, .cpp, .svelte и файл без содержимого", async ({
    page,
  }) => {
    await page.evaluate(
      async ({ actionsPath, storesPath }) => {
        const { setProjectTreeSource }: ActionsModule = await import(
          /* @vite-ignore */ actionsPath
        );
        const file = (name: string, text: string) => new File([text], name);
        await setProjectTreeSource({
          rootName: "demo",
          fileCount: 4,
          nodes: [
            {
              name: "src",
              path: "src",
              type: "directory",
              children: [
                {
                  name: "app.py",
                  path: "src/app.py",
                  type: "file",
                  children: [],
                  fileRef: file("app.py", "def run():\n    pass\n"),
                },
                {
                  name: "lib.cpp",
                  path: "src/lib.cpp",
                  type: "file",
                  children: [],
                  fileRef: file("lib.cpp", "int sum(int a) { return a; }"),
                },
                {
                  name: "Card.svelte",
                  path: "src/Card.svelte",
                  type: "file",
                  children: [],
                  fileRef: file(
                    "Card.svelte",
                    '<div></div>\n<script lang="ts">\n  function onClick(): void {}\n</script>',
                  ),
                },
                {
                  name: "lost.ts",
                  path: "src/lost.ts",
                  type: "file",
                  children: [],
                },
              ],
            },
            { name: "docs", path: "docs", type: "directory", children: [] },
          ],
        });
        const { isCodeMapOpen }: StoresModule = await import(
          /* @vite-ignore */ storesPath
        );
        isCodeMapOpen.set(true);
      },
      {
        actionsPath: "/src/utils/projectActions.ts",
        storesPath: "/src/stores/index.ts",
      },
    );

    const dialog = page.getByRole("dialog", { name: "Генератор карты кода" });
    await dialog.getByRole("button", { name: "Сгенерировать" }).click();
    const map = dialog.locator("pre");
    await expect(map).toContainText("L1 def run(): ...");
    await expect(map).toContainText("L1 int sum(int a) { ... }");
    await expect(map).toContainText("L3 function onClick(): void { ... }");
    await expect(map).not.toContainText("docs/");
    await expect(dialog.getByRole("status")).toContainText("Пропущено 1 файл");
  });
});
