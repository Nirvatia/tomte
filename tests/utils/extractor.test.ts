import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  extractFilesFromMarkdown,
  convertToAttachedFile,
  downloadFile,
} from "../../src/utils/extractor";
import type { ExtractedFile } from "../../src/utils/extractor";

describe("extractFilesFromMarkdown", () => {
  it("извлекает файл из code block с именем в **жирном**", () => {
    const md = `Вот код:\n**app.js**\n\`\`\`js\nconsole.log("hello");\nconsole.log("world");\n\`\`\``;
    const files = extractFilesFromMarkdown(md);

    expect(files).toHaveLength(1);
    expect(files[0].name).toBe("app.js");
    expect(files[0].lang).toBe("js");
    expect(files[0].code).toContain('console.log("hello");');
  });

  it("извлекает файл из code block с FILE: паттерном", () => {
    const md = `FILE: "src/main.py"\n\`\`\`python\ndef main():\n    print("hello")\n    return 42\n\`\`\``;
    const files = extractFilesFromMarkdown(md);

    expect(files).toHaveLength(1);
    expect(files[0].name).toBe("src/main.py");
    expect(files[0].lang).toBe("python");
  });

  it("извлекает несколько файлов", () => {
    const md = `
**app.js**
\`\`\`js
const a = 1;
const b = 2;
\`\`\`

**style.css**
\`\`\`css
body { margin: 0; padding: 0; }
\`\`\`
`;
    const files = extractFilesFromMarkdown(md);

    expect(files).toHaveLength(2);
    expect(files[0].name).toBe("app.js");
    expect(files[1].name).toBe("style.css");
  });

  it("автогенерирует имя при отсутствии паттерна", () => {
    const md = `\`\`\`python\ndef main():\n    print("hello")\n    return 42\n\`\`\``;
    const files = extractFilesFromMarkdown(md);

    expect(files).toHaveLength(1);
    expect(files[0].name).toBe("file_1.py");
  });

  it("дедуплицирует имена файлов", () => {
    const md = `
**app.js**
\`\`\`js
const a = 1;
const b = 2;
\`\`\`

**app.js**
\`\`\`js
const c = 3;
const d = 4;
\`\`\`
`;
    const files = extractFilesFromMarkdown(md);

    expect(files).toHaveLength(2);
    expect(files[0].name).toBe("app.js");
    expect(files[1].name).toBe("app_2.js");
  });

  it("пропускает слишком короткие блоки без языка", () => {
    const md = `\`\`\`\nx\n\`\`\``;
    const files = extractFilesFromMarkdown(md);

    expect(files).toHaveLength(0);
  });

  it("не пропускает короткие блоки с указанием языка", () => {
    const md = `\`\`\`js\nx\n\`\`\``;
    const files = extractFilesFromMarkdown(md);

    expect(files).toHaveLength(1);
  });

  it("нормализует типографские кавычки", () => {
    const md = `FILE: \u201Capp.js\u201D\n\`\`\`js\nconst a = 1;\nconst b = 2;\n\`\`\``;
    const files = extractFilesFromMarkdown(md);

    expect(files).toHaveLength(1);
    expect(files[0].name).toBe("app.js");
  });

  it("возвращает пустой массив для пустого текста", () => {
    expect(extractFilesFromMarkdown("")).toHaveLength(0);
    expect(extractFilesFromMarkdown("просто текст")).toHaveLength(0);
  });

  it("генерирует уникальный id для каждого файла", () => {
    const md = `
**a.js**
\`\`\`js
const a = 1;
const b = 2;
\`\`\`

**b.js**
\`\`\`js
const c = 3;
const d = 4;
\`\`\`
`;
    const files = extractFilesFromMarkdown(md);
    const ids = files.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("распознаёт svelte-файлы", () => {
    const md = `**App.svelte**\n\`\`\`svelte\n<script>\n  let count = 0;\n</script>\n<button>{count}</button>\n\`\`\``;
    const files = extractFilesFromMarkdown(md);

    expect(files).toHaveLength(1);
    expect(files[0].lang).toBe("svelte");
  });
});

describe("convertToAttachedFile", () => {
  it("конвертирует ExtractedFile в AttachedFile", () => {
    const extracted: ExtractedFile = {
      id: "test-id",
      name: "app.js",
      lang: "js",
      code: 'console.log("hello");',
    };

    const result = convertToAttachedFile(extracted);

    expect(result.id).toBe("test-id");
    expect(result.name).toBe("app.js");
    expect(result.type).toBe("text");
    expect(result.content).toBe('console.log("hello");');
    expect(result.size).toBe(extracted.code.length);
    expect(result.ext).toBe("js");
  });

  it("определяет расширение из имени файла", () => {
    const extracted: ExtractedFile = {
      id: "1",
      name: "style.css",
      lang: "css",
      code: "body {}",
    };

    expect(convertToAttachedFile(extracted).ext).toBe("css");
  });

  it("возвращает 'txt' если расширения нет", () => {
    const extracted: ExtractedFile = {
      id: "1",
      name: "Makefile",
      lang: "",
      code: "all: build",
    };

    expect(convertToAttachedFile(extracted).ext).toBe("txt");
  });
});

describe("downloadFile", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("создаёт blob и вызывает клик по ссылке", () => {
    const createObjectURL = vi.fn().mockReturnValue("blob:test");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });

    const clickSpy = vi.fn();
    const appendChildSpy = vi.spyOn(document.body, "appendChild").mockImplementation(() => ({} as any));
    const removeChildSpy = vi.spyOn(document.body, "removeChild").mockImplementation(() => ({} as any));
    vi.spyOn(document, "createElement").mockReturnValue({
      href: "",
      download: "",
      click: clickSpy,
    } as any);

    downloadFile("hello", "test.txt");

    expect(createObjectURL).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:test");

    appendChildSpy.mockRestore();
    removeChildSpy.mockRestore();
  });
});