// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  estimateAttachmentTokens,
  estimateHtmlTokens,
  estimateTokens,
  getCachedTreeTokens,
  htmlToPlainText,
  loadTreeFileTokens,
  resetTreeTokenCache,
} from "../../src/utils/tokens";
import type { AttachedFile } from "../../src/types";
import type { TreeNode } from "../../src/utils/projectTree";

vi.mock("../../src/utils/github", () => ({
  fetchGithubFileContent: vi.fn(),
}));

/**
 * Образцы с эталонными счётами настоящих токенайзеров OpenAI (o200k, cl100k),
 * посчитанными при калибровке. Допуск ±25%: это оценка, а не точный счёт.
 * Главное, что ловят эти тесты, — перекос на плотных данных: прежняя оценка
 * «символов на токен» занижала JSON вдвое.
 */
const SAMPLES = {
  en: {
    text: "The quick brown fox jumps over the lazy dog. Prompts are easier to build when the code, the folder tree and the screenshots live in one place, so you can see what the model will actually receive.",
    real: 42,
  },
  ru: {
    text: "Промпты проще собирать, когда код, дерево папок и скриншоты лежат в одном месте: сразу видно, что именно получит модель, и не нужно копировать куски вручную.",
    real: 58,
  },
  ts: {
    text: "export function estimateTokens(text: string): number {\n  if (!text) return 0;\n  let total = 0;\n  for (let i = 0; i < text.length; i++) {\n    total += weight(text.charCodeAt(i));\n  }\n  return Math.max(1, Math.round(total));\n}\n",
    real: 66,
  },
  json: {
    text: '{\n  "name": "demo",\n  "version": "1.2.3",\n  "dependencies": {\n    "@sveltejs/kit": "^2.63.0",\n    "tailwindcss": "^4.3.1"\n  },\n  "resolved": "https://registry.npmjs.org/svelte/-/svelte-5.56.1.tgz",\n  "integrity": "sha512-4fJq0pQ2yVx9uYk7aN1mZs3dLwBt8HcE5oRgXnV6iTq0KaUeWjPzS1YdFhM2lOxC=="\n}\n',
    real: 153,
  },
} as const;

describe("estimateTokens", () => {
  it("пустая строка — 0 токенов", () => {
    expect(estimateTokens("")).toBe(0);
  });

  it("любой непустой текст — не меньше одного токена", () => {
    expect(estimateTokens(" ")).toBe(1);
    expect(estimateTokens("a")).toBe(1);
  });

  it.each(Object.entries(SAMPLES))(
    "образец «%s» в пределах ±25%% от настоящего токенайзера",
    (_name, { text, real }) => {
      const estimate = estimateTokens(text);
      expect(estimate).toBeGreaterThanOrEqual(real * 0.75);
      expect(estimate).toBeLessThanOrEqual(real * 1.25);
    },
  );

  it("плотные данные дороже прозы той же длины", () => {
    const prose = "word ".repeat(100);
    const dense = '{"a":1,"b":2,"c":3,'.repeat(25);
    expect(dense.length).toBeCloseTo(prose.length, -2);
    expect(estimateTokens(dense)).toBeGreaterThan(estimateTokens(prose) * 2);
  });

  it("хеш дороже слова той же длины, а длинное слово без цифр не штрафуется", () => {
    const hash = "sha512-4fJq0pQ2yVx9uYk7aN1mZs3dLwBt8HcE5oRgXnV6iTq0";
    const word = "a".repeat(hash.length);
    expect(estimateTokens(hash)).toBeGreaterThan(estimateTokens(word) * 2);
    // Без цифр доплаты нет: только вес букв.
    expect(estimateTokens(word)).toBe(Math.round(word.length * 0.205));
  });

  it("цифры дороже букв", () => {
    expect(estimateTokens("1234567890".repeat(10))).toBeGreaterThan(
      estimateTokens("abcdefghij".repeat(10)) * 2,
    );
  });

  it("кириллица дороже латиницы той же длины", () => {
    const ratio =
      estimateTokens("привет".repeat(50)) / estimateTokens("hello!".repeat(50));
    expect(ratio).toBeGreaterThan(1.5);
  });

  it("растёт вместе с текстом", () => {
    expect(estimateTokens("слово ".repeat(200))).toBeGreaterThan(
      estimateTokens("слово ".repeat(100)),
    );
  });

  it("эмодзи (суррогатная пара) считается одним символом, а не двумя", () => {
    const one = estimateTokens("😀");
    expect(one).toBe(2); // 1,5 токена, округление вверх
    expect(estimateTokens("😀😀😀😀")).toBe(6);
  });

  it("иероглифы не считаются как знаки препинания", () => {
    expect(estimateTokens("汉字".repeat(50))).toBeGreaterThan(
      estimateTokens("..".repeat(50)),
    );
  });
});

describe("htmlToPlainText и estimateHtmlTokens", () => {
  it("достаёт видимый текст и отбрасывает теги", () => {
    expect(htmlToPlainText("<p>Привет, <strong>мир</strong></p>")).toBe(
      "Привет, мир",
    );
  });

  it("пустой и пробельный HTML — пустой текст", () => {
    expect(htmlToPlainText("")).toBe("");
    expect(htmlToPlainText("   ")).toBe("");
  });

  it("токены HTML считаются по тексту, а не по разметке", () => {
    const withMarkup = estimateHtmlTokens(
      "<p><strong>hello world</strong></p>",
    );
    expect(withMarkup).toBe(estimateTokens("hello world"));
  });
});

describe("estimateAttachmentTokens", () => {
  const base = {
    id: "1",
    name: "f",
    size: 700,
    mimeType: "text/plain",
  };

  it("изображения и бинарные файлы — 0", () => {
    expect(
      estimateAttachmentTokens({ ...base, type: "image" } as AttachedFile),
    ).toBe(0);
    expect(
      estimateAttachmentTokens({ ...base, type: "binary" } as AttachedFile),
    ).toBe(0);
  });

  it("текстовый файл считается по содержимому", () => {
    const file = {
      ...base,
      type: "text",
      content: "hello world",
    } as AttachedFile;
    expect(estimateAttachmentTokens(file)).toBe(estimateTokens("hello world"));
  });

  it("без содержимого оценка идёт от размера в байтах", () => {
    const file = { ...base, type: "text" } as AttachedFile;
    expect(estimateAttachmentTokens(file)).toBe(200);
  });
});

describe("loadTreeFileTokens", () => {
  const node = (path: string, text?: string): TreeNode =>
    ({
      name: path,
      path,
      type: "file",
      children: [],
      ...(text !== undefined ? { fileRef: new File([text], path) } : {}),
    }) as TreeNode;

  beforeEach(() => resetTreeTokenCache());

  it("читает файл, считает токены и кэширует результат", async () => {
    const n = node("a.ts", "const answer = 42;");
    expect(getCachedTreeTokens("a.ts")).toBeUndefined();

    const tokens = await loadTreeFileTokens(n);

    expect(tokens).toBe(estimateTokens("const answer = 42;"));
    expect(getCachedTreeTokens("a.ts")).toBe(tokens);
  });

  it("повторный вызов берёт значение из кэша, не читая файл", async () => {
    const n = node("b.ts", "let x = 1;");
    const first = await loadTreeFileTokens(n);
    const spy = vi.spyOn(File.prototype, "text");

    expect(await loadTreeFileTokens(n)).toBe(first);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("у узла без содержимого — 0, и это тоже кэшируется", async () => {
    expect(await loadTreeFileTokens(node("c.ts"))).toBe(0);
    expect(getCachedTreeTokens("c.ts")).toBe(0);
  });

  it("сброс кэша забывает посчитанное", async () => {
    await loadTreeFileTokens(node("d.ts", "x"));
    resetTreeTokenCache();
    expect(getCachedTreeTokens("d.ts")).toBeUndefined();
  });
});
