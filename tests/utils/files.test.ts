import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AttachedFile } from "../../src/types";
import {
  isTextFile,
  getPlaceholderPrefix,
  getPlaceholderIndex,
  getPlaceholder,
  processFile,
  imageFilesFromClipboard,
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
    const file = new File(["hello world"], "test.md", {
      type: "text/markdown",
    });
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

  describe("изображения", () => {
    // happy-dom не декодирует картинки: подставляем decode и размеры.
    function stubImageDecoding(result: "ok" | "fail") {
      vi.spyOn(HTMLImageElement.prototype, "decode").mockImplementation(() =>
        result === "ok"
          ? Promise.resolve()
          : Promise.reject(new Error("bad image")),
      );
      vi.spyOn(
        HTMLImageElement.prototype,
        "naturalWidth",
        "get",
      ).mockReturnValue(800);
      vi.spyOn(
        HTMLImageElement.prototype,
        "naturalHeight",
        "get",
      ).mockReturnValue(600);
    }

    it("читает картинку как data URL и запоминает размеры", async () => {
      stubImageDecoding("ok");
      const file = new File([new Uint8Array([1, 2, 3])], "photo.png", {
        type: "image/png",
      });

      const result = await processFile(file);

      expect(result).toMatchObject({
        type: "image",
        width: 800,
        height: 600,
        ext: "png",
      });
      expect(result.dataUrl).toMatch(/^data:image\/png;base64,/);
    });

    it("распознаёт картинку по расширению, если MIME пустой", async () => {
      stubImageDecoding("ok");
      const file = new File([new Uint8Array([1])], "icon.webp", { type: "" });

      expect((await processFile(file)).type).toBe("image");
    });

    it("битую картинку сохраняет как файл без содержимого, а не теряет", async () => {
      stubImageDecoding("fail");
      vi.spyOn(console, "warn").mockImplementation(() => {});
      const file = new File([new Uint8Array([1])], "broken.png", {
        type: "image/png",
      });

      const result = await processFile(file);

      expect(result).toMatchObject({
        type: "binary",
        name: "broken.png",
        size: 1,
      });
      expect(result.dataUrl).toBeUndefined();
    });
  });

  it("PDF и прочие бинарные файлы сохраняет как метаданные", async () => {
    const file = new File([new Uint8Array(10)], "doc.pdf", {
      type: "application/pdf",
    });

    const result = await processFile(file);

    expect(result).toMatchObject({
      type: "binary",
      name: "doc.pdf",
      size: 10,
      ext: "pdf",
    });
    expect(result.content).toBeUndefined();
    expect(result.dataUrl).toBeUndefined();
  });
});

describe("нумерация плейсхолдеров", () => {
  it("бинарные и текстовые файлы делят одну нумерацию [FILE_n]", () => {
    const text = makeFile("a.txt");
    const pdf: AttachedFile = {
      id: "pdf",
      name: "b.pdf",
      size: 1,
      type: "binary",
    };
    const image = makeFile("c.png", "image");
    const all = [text, image, pdf];

    expect(getPlaceholder(text, all)).toBe("[FILE_1: a.txt]");
    expect(getPlaceholder(pdf, all)).toBe("[FILE_2: b.pdf]");
    expect(getPlaceholder(image, all)).toBe("[IMAGE_1: c.png]");
  });
});

describe("imageFilesFromClipboard", () => {
  function clipboard(
    items: Array<{ kind: string; type: string; file?: File }>,
  ) {
    return {
      items: items.map((item) => ({
        kind: item.kind,
        type: item.type,
        getAsFile: () => item.file ?? null,
      })),
    } as unknown as DataTransfer;
  }

  it("берёт только файлы-картинки", () => {
    const png = new File(["x"], "shot.png", { type: "image/png" });
    const files = imageFilesFromClipboard(
      clipboard([
        { kind: "string", type: "text/html" },
        { kind: "file", type: "image/png", file: png },
        {
          kind: "file",
          type: "application/pdf",
          file: new File(["y"], "a.pdf"),
        },
      ]),
    );
    expect(files).toEqual([png]);
  });

  it("пустой буфер и текст без картинок дают пустой список", () => {
    expect(imageFilesFromClipboard(null)).toEqual([]);
    expect(
      imageFilesFromClipboard(
        clipboard([{ kind: "string", type: "text/plain" }]),
      ),
    ).toEqual([]);
  });
});
