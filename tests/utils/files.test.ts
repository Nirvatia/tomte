import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AttachedFile } from "../../src/types";
import {
  isTextFile,
  getPlaceholderPrefix,
  getPlaceholderIndex,
  getPlaceholder,
  processFile,
  TEXT_EXTENSIONS,
} from "../../src/utils/files";

function makeFile(name: string, type: "text" | "image" = "text"): AttachedFile {
  return {
    id: `id-${name}`,
    name,
    size: 100,
    type,
    content: type === "text" ? "hello" : undefined,
    dataUrl: type === "image" ? "data:image/png;base64,abc" : undefined,
  };
}

describe("isTextFile", () => {
  it("распознаёт текстовые расширения", () => {
    for (const ext of TEXT_EXTENSIONS) {
      expect(isTextFile(`test.${ext}`)).toBe(true);
    }
  });

  it("отклоняет бинарные расширения", () => {
    expect(isTextFile("photo.png")).toBe(false);
    expect(isTextFile("image.jpg")).toBe(false);
    expect(isTextFile("archive.zip")).toBe(false);
    expect(isTextFile("video.mp4")).toBe(false);
    expect(isTextFile("data.bin")).toBe(false);
  });

  it("обрабатывает файлы без расширения", () => {
    expect(isTextFile("Makefile")).toBe(false);
  });

  it("не зависит от регистра", () => {
    expect(isTextFile("README.MD")).toBe(true);
    expect(isTextFile("script.PY")).toBe(true);
    expect(isTextFile("PHOTO.PNG")).toBe(false);
  });
});

describe("getPlaceholderPrefix", () => {
  it("возвращает IMAGE для изображений", () => {
    const file = makeFile("photo.png", "image");
    expect(getPlaceholderPrefix(file)).toBe("IMAGE");
  });

  it("возвращает FILE для текстовых файлов", () => {
    const file = makeFile("readme.md", "text");
    expect(getPlaceholderPrefix(file)).toBe("FILE");
  });
});

describe("getPlaceholderIndex", () => {
  it("возвращает 1 для первого файла своего типа", () => {
    const files = [makeFile("a.md"), makeFile("b.md"), makeFile("c.md")];
    expect(getPlaceholderIndex(files[0], files)).toBe(1);
  });

  it("возвращает правильный индекс", () => {
    const files = [makeFile("a.md"), makeFile("b.md"), makeFile("c.md")];
    expect(getPlaceholderIndex(files[1], files)).toBe(2);
    expect(getPlaceholderIndex(files[2], files)).toBe(3);
  });

  it("считает отдельно для разных типов", () => {
    const files = [
      makeFile("a.md", "text"),
      makeFile("img.png", "image"),
      makeFile("b.md", "text"),
      makeFile("img2.png", "image"),
    ];
    expect(getPlaceholderIndex(files[0], files)).toBe(1);
    expect(getPlaceholderIndex(files[1], files)).toBe(1);
    expect(getPlaceholderIndex(files[2], files)).toBe(2);
    expect(getPlaceholderIndex(files[3], files)).toBe(2);
  });

  it("возвращает следующий индекс если файл не найден в списке", () => {
    const files = [makeFile("a.md")];
    const orphan = makeFile("orphan.md");
    expect(getPlaceholderIndex(orphan, files)).toBe(2);
  });
});

describe("getPlaceholder", () => {
  it("формирует плейсхолдер для текстового файла", () => {
    const files = [makeFile("readme.md")];
    expect(getPlaceholder(files[0], files)).toBe("[FILE_1: readme.md]");
  });

  it("формирует плейсхолдер для изображения", () => {
    const files = [makeFile("photo.png", "image")];
    expect(getPlaceholder(files[0], files)).toBe("[IMAGE_1: photo.png]");
  });

  it("учитывает индекс среди файлов того же типа", () => {
    const files = [
      makeFile("a.md", "text"),
      makeFile("img.png", "image"),
      makeFile("b.md", "text"),
    ];
    expect(getPlaceholder(files[2], files)).toBe("[FILE_2: b.md]");
  });
});

describe("processFile", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("обрабатывает текстовый файл", async () => {
    const file = new File(["hello world"], "test.md", { type: "text/markdown" });
    const result = await processFile(file);

    expect(result.name).toBe("test.md");
    expect(result.type).toBe("text");
    expect(result.content).toBe("hello world");
    expect(result.size).toBe(file.size);
    expect(result.ext).toBe("md");
    expect(result.id).toBeTruthy();
  });

  it("обрабатывает файл без расширения", async () => {
    const file = new File(["data"], "Makefile", { type: "text/plain" });
    const result = await processFile(file);

    expect(result.name).toBe("Makefile");
    expect(result.ext).toBe("makefile");
  });

  it("обрабатывает изображение", async () => {
    const mockDataUrl = "data:image/png;base64,iVBORw0KGgo=";

    const mockFileReaderInstance = {
      readAsDataURL: vi.fn(),
      onload: null as any,
      onerror: null as any,
      result: mockDataUrl,
    };

    // ИСПРАВЛЕНО: обычная function вместо стрелочной — работает с `new`
    vi.stubGlobal(
      "FileReader",
      vi.fn(function (this: any) {
        Object.assign(this, mockFileReaderInstance);
        mockFileReaderInstance.readAsDataURL = this.readAsDataURL;
        mockFileReaderInstance.onload = null;
        mockFileReaderInstance.onerror = null;
        // Переназначаем ссылки, чтобы тест мог дёргать onload/onerror
        const self = this;
        Object.defineProperty(mockFileReaderInstance, "onload", {
          get: () => self.onload,
          set: (v) => { self.onload = v; },
        });
        Object.defineProperty(mockFileReaderInstance, "onerror", {
          get: () => self.onerror,
          set: (v) => { self.onerror = v; },
        });
      }),
    );

    const mockImgInstance = {
      onload: null as any,
      onerror: null as any,
      naturalWidth: 800,
      naturalHeight: 600,
      src: "",
    };

    vi.stubGlobal(
      "Image",
      vi.fn(function (this: any) {
        Object.assign(this, mockImgInstance);
        const self = this;
        Object.defineProperty(mockImgInstance, "onload", {
          get: () => self.onload,
          set: (v) => { self.onload = v; },
        });
        Object.defineProperty(mockImgInstance, "onerror", {
          get: () => self.onerror,
          set: (v) => { self.onerror = v; },
        });
        Object.defineProperty(mockImgInstance, "src", {
          get: () => self.src,
          set: (v) => { self.src = v; },
        });
      }),
    );

    const file = new File([new ArrayBuffer(100)], "photo.png", { type: "image/png" });
    const promise = processFile(file);

    // Ждём микрозадачу, чтобы processFile успел создать FileReader и назначить onload
    await new Promise((r) => setTimeout(r, 0));

    mockFileReaderInstance.onload!({ target: { result: mockDataUrl } } as any);

    await new Promise((r) => setTimeout(r, 0));

    mockImgInstance.onload!();

    const result = await promise;

    expect(result.type).toBe("image");
    expect(result.dataUrl).toBe(mockDataUrl);
    expect(result.width).toBe(800);
    expect(result.height).toBe(600);
  });

  it("отклоняет промис при ошибке FileReader", async () => {
    const mockFileReaderInstance = {
      readAsDataURL: vi.fn(),
      onload: null as any,
      onerror: null as any,
    };

    vi.stubGlobal(
      "FileReader",
      vi.fn(function (this: any) {
        Object.assign(this, mockFileReaderInstance);
        const self = this;
        Object.defineProperty(mockFileReaderInstance, "onload", {
          get: () => self.onload,
          set: (v) => { self.onload = v; },
        });
        Object.defineProperty(mockFileReaderInstance, "onerror", {
          get: () => self.onerror,
          set: (v) => { self.onerror = v; },
        });
      }),
    );

    const file = new File([new ArrayBuffer(100)], "photo.png", { type: "image/png" });
    const promise = processFile(file);

    await new Promise((r) => setTimeout(r, 0));

    mockFileReaderInstance.onerror!(new Error("read error"));

    await expect(promise).rejects.toThrow("read error");
  });
});