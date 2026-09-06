// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createExportContainer,
  removeContainer,
  waitForImages,
  escapeHtml,
  buildAttachmentsHtml,
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

describe("buildAttachmentsHtml", () => {
  it("возвращает пустую строку для пустого массива", () => {
    expect(buildAttachmentsHtml([])).toBe("");
  });

  it("содержит заголовок с количеством файлов", () => {
    const files = [makeFile({ name: "a.txt", content: "hello" })];
    const html = buildAttachmentsHtml(files);
    expect(html).toContain("Вложения (1)");
  });

  it("рендерит изображения с dataUrl", () => {
    const files = [
      makeFile({
        type: "image",
        name: "photo.png",
        dataUrl: "data:image/png;base64,AAA",
      }),
    ];
    const html = buildAttachmentsHtml(files);
    expect(html).toContain("Изображения");
    expect(html).toContain("IMAGE_1: photo.png");
    expect(html).toContain('src="data:image/png;base64,AAA"');
  });

  it("не рендерит изображения без dataUrl", () => {
    const files = [makeFile({ type: "image", name: "photo.png" })];
    const html = buildAttachmentsHtml(files);
    expect(html).not.toContain("Изображения");
  });

  it("рендерит текстовые файлы с содержимым", () => {
    const files = [makeFile({ type: "text", name: "code.js", content: "console.log(1)" })];
    const html = buildAttachmentsHtml(files);
    expect(html).toContain("Текстовые файлы");
    expect(html).toContain("FILE_1: code.js");
    expect(html).toContain("console.log(1)");
  });

  it("не рендерит текстовые файлы без содержимого", () => {
    const files = [makeFile({ type: "text", name: "empty.txt" })];
    const html = buildAttachmentsHtml(files);
    expect(html).not.toContain("Текстовые файлы");
  });

  it("нумерует изображения и текстовые файлы отдельно", () => {
    const files = [
      makeFile({ type: "image", name: "img1.png", dataUrl: "data:image/png;base64,A" }),
      makeFile({ type: "image", name: "img2.png", dataUrl: "data:image/png;base64,B" }),
      makeFile({ type: "text", name: "a.txt", content: "text" }),
    ];
    const html = buildAttachmentsHtml(files);
    expect(html).toContain("IMAGE_1: img1.png");
    expect(html).toContain("IMAGE_2: img2.png");
    expect(html).toContain("FILE_1: a.txt");
  });

  it("экранирует имена файлов в HTML", () => {
    const files = [makeFile({ type: "text", name: '<script>alert("x")</script>.txt', content: "safe" })];
    const html = buildAttachmentsHtml(files);
    expect(html).not.toContain('<script>alert("x")</script>');
    expect(html).toContain("&lt;script&gt;");
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