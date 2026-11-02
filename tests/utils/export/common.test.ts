// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import {
  createExportContainer,
  removeContainer,
  waitForImages,
  escapeHtml,
  exportTitle,
} from "../../../src/utils/export/common";
import type { AttachedFile } from "../../../src/types";

function makeFile(overrides: Partial<AttachedFile> = {}): AttachedFile {
  return {
    id: overrides.id ?? "file-1",
    name: overrides.name ?? "test.txt",
    size: overrides.size ?? 100,
    type: overrides.type ?? "text",
    content: overrides.content,
    dataUrl: overrides.dataUrl,
    ext: overrides.ext ?? "txt",
    width: overrides.width,
    height: overrides.height,
  };
}

describe("escapeHtml", () => {
  it("экранирует амперсанд", () => {
    expect(escapeHtml("a & b")).toBe("a &amp; b");
  });

  it("экранирует угловые скобки", () => {
    expect(escapeHtml("<div>")).toBe("&lt;div&gt;");
  });

  it("экранирует двойные кавычки", () => {
    expect(escapeHtml('say "hello"')).toBe("say &quot;hello&quot;");
  });

  it("экранирует одинарные кавычки", () => {
    expect(escapeHtml("it's")).toBe("it&#39;s");
  });

  it("экранирует все спецсимволы одновременно", () => {
    expect(escapeHtml('<a href="x">&\'')).toBe(
      "&lt;a href=&quot;x&quot;&gt;&amp;&#39;",
    );
  });

  it("не изменяет строку без спецсимволов", () => {
    expect(escapeHtml("plain text")).toBe("plain text");
  });

  it("возвращает пустую строку для пустого ввода", () => {
    expect(escapeHtml("")).toBe("");
  });
});

describe("createExportContainer / removeContainer", () => {
  it("создаёт контейнер и добавляет его в body", () => {
    const container = createExportContainer("<p>Hello</p>");
    expect(document.body.contains(container)).toBe(true);
    expect(container.innerHTML).toContain("Hello");
    removeContainer(container);
  });

  it("removeContainer удаляет контейнер из body", () => {
    const container = createExportContainer("<p>Test</p>");
    expect(document.body.contains(container)).toBe(true);
    removeContainer(container);
    expect(document.body.contains(container)).toBe(false);
  });

  it("removeContainer не бросает ошибку, если контейнер уже удалён", () => {
    const container = createExportContainer("<p>Test</p>");
    document.body.removeChild(container);
    expect(() => removeContainer(container)).not.toThrow();
  });

  it("контейнер содержит класс preview-content", () => {
    const container = createExportContainer("<p>Content</p>");
    expect(container.querySelector(".preview-content")).not.toBeNull();
    removeContainer(container);
  });
});

describe("waitForImages", () => {
  it("резолвится мгновенно, если изображений нет", async () => {
    const div = document.createElement("div");
    div.innerHTML = "<p>No images</p>";
    await expect(waitForImages(div)).resolves.toBeUndefined();
  });

  it("резолвится, если все изображения уже загружены", async () => {
    const div = document.createElement("div");
    const img = document.createElement("img");
    Object.defineProperty(img, "complete", { value: true });
    div.appendChild(img);
    await expect(waitForImages(div)).resolves.toBeUndefined();
  });

  it("ждёт загрузку незагруженных изображений", async () => {
    const div = document.createElement("div");
    const img = document.createElement("img");
    Object.defineProperty(img, "complete", { value: false });
    div.appendChild(img);

    const promise = waitForImages(div);

    // Имитируем загрузку
    img.onload?.call(img, new Event("load"));

    await expect(promise).resolves.toBeUndefined();
  });

  it("резолвится даже при ошибке загрузки изображения", async () => {
    const div = document.createElement("div");
    const img = document.createElement("img");
    Object.defineProperty(img, "complete", { value: false });
    div.appendChild(img);

    const promise = waitForImages(div);

    // Имитируем ошибку загрузки
    img.onerror?.call(img, new Event("error"));

    await expect(promise).resolves.toBeUndefined();
  });
});

describe("exportTitle", () => {
  it("подписывает файл меткой из редактора", () => {
    const file = { ...makeFile({ name: "notes.md" }), label: "FILE_2" };
    expect(exportTitle(file, [file])).toBe("FILE_2: notes.md");
  });

  it("файл без метки (из дерева) подписывает только именем", () => {
    const file = { ...makeFile({ name: "src/a.ts" }), label: null };
    expect(exportTitle(file, [file])).toBe("src/a.ts");
  });

  it("без заданной метки считает её по переданному списку", () => {
    const a = makeFile({ id: "a", name: "a.md" });
    const b = makeFile({ id: "b", name: "b.md" });
    expect(exportTitle(b, [a, b])).toBe("FILE_2: b.md");
  });
});
