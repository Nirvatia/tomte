// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/svelte";
import "@testing-library/jest-dom/vitest";

import FileItem from "../../../src/components/attachments/FileItem.svelte";
import type { AttachedFile } from "../../../src/types";

vi.mock("../../../src/utils", () => ({
  formatFileSize: vi.fn(() => "1 КБ"),
}));

vi.mock("../../../src/utils/files", () => ({
  getPlaceholderPrefix: vi.fn((file: any) =>
    file.type === "image" ? "IMAGE" : "FILE",
  ),
  getPlaceholderIndex: vi.fn(() => 3),
}));

function makeFile(overrides: Partial<AttachedFile> = {}): AttachedFile {
  return {
    id: "file-1",
    name: "file.txt",
    size: 1024,
    type: "text",
    content: "text content",
    ext: "txt",
    ...overrides,
  };
}

describe("FileItem", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Рендеринг", () => {
    it("показывает имя файла и размер", () => {
      render(FileItem, {
        props: {
          file: makeFile({ name: "notes.txt" }),
        },
      });

      expect(screen.getByText("notes.txt")).toBeInTheDocument();
      expect(screen.getByText("1 КБ")).toBeInTheDocument();
    });

    it("показывает placeholder для текстового файла", () => {
      render(FileItem, {
        props: {
          file: makeFile(),
        },
      });

      expect(screen.getByText("FILE_3")).toBeInTheDocument();
    });

    it("показывает IMAGE placeholder для изображения", () => {
      render(FileItem, {
        props: {
          file: makeFile({
            type: "image",
            dataUrl: "data:image/png;base64,AAA",
            name: "img.png",
          }),
        },
      });

      expect(screen.getByText("IMAGE_3")).toBeInTheDocument();
    });

    it("рендерит картинку, если это изображение с dataUrl", () => {
      render(FileItem, {
        props: {
          file: makeFile({
            type: "image",
            dataUrl: "data:image/png;base64,AAA",
            name: "img.png",
          }),
        },
      });

      const img = screen.getByRole("img", { name: "img.png" });

      expect(img).toHaveAttribute("src", "data:image/png;base64,AAA");
    });

    it("не рендерит картинку для текстового файла", () => {
      render(FileItem, {
        props: {
          file: makeFile(),
        },
      });

      expect(screen.queryByRole("img")).toBeNull();
    });

    it("показывает предупреждение, если у текстового файла нет содержимого", () => {
      render(FileItem, {
        props: {
          file: makeFile({ content: undefined }),
        },
      });

      expect(
        screen.getByTitle("Содержимое не сохранено (только метаданные)"),
      ).toBeInTheDocument();
    });

    it("не показывает предупреждение, если у текстового файла есть содержимое", () => {
      render(FileItem, {
        props: {
          file: makeFile({ content: "hello" }),
        },
      });

      expect(
        screen.queryByTitle("Содержимое не сохранено (только метаданные)"),
      ).toBeNull();
    });

    it("показывает предупреждение, если у изображения нет dataUrl", () => {
      render(FileItem, {
        props: {
          file: makeFile({
            type: "image",
            dataUrl: undefined,
          }),
        },
      });

      expect(
        screen.getByTitle("Содержимое не сохранено (только метаданные)"),
      ).toBeInTheDocument();
    });
  });

  describe("Выбор файла", () => {
    it("показывает чекбокс с понятным именем", () => {
      render(FileItem, {
        props: {
          file: makeFile({ name: "report.txt" }),
        },
      });

      expect(
        screen.getByRole("checkbox", { name: "Выбрать файл report.txt" }),
      ).toBeInTheDocument();
    });

    it("отмечает чекбокс, если файл выбран", () => {
      render(FileItem, {
        props: {
          file: makeFile(),
          isSelected: true,
        },
      });

      expect(
        screen.getByRole("checkbox", { name: "Выбрать файл file.txt" }),
      ).toBeChecked();
    });

    it("вызывает onToggleSelect с id файла", async () => {
      const onToggleSelect = vi.fn();

      render(FileItem, {
        props: {
          file: makeFile({ id: "attachment-1" }),
          onToggleSelect,
        },
      });

      await fireEvent.click(
        screen.getByRole("checkbox", { name: "Выбрать файл file.txt" }),
      );

      expect(onToggleSelect).toHaveBeenCalledWith("attachment-1");
    });
  });

  describe("Действия", () => {
    it("вызывает onRemove с id файла", async () => {
      const onRemove = vi.fn();

      render(FileItem, {
        props: {
          file: makeFile({ id: "attachment-1" }),
          onRemove,
        },
      });

      await fireEvent.click(
        screen.getByRole("button", { name: "Удалить файл file.txt" }),
      );

      expect(onRemove).toHaveBeenCalledWith("attachment-1");
    });

    it("вызывает onPreview с файлом", async () => {
      const onPreview = vi.fn();
      const file = makeFile();

      render(FileItem, {
        props: {
          file,
          onPreview,
        },
      });

      await fireEvent.click(
        screen.getByRole("button", { name: "Просмотреть файл file.txt" }),
      );

      expect(onPreview).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "file-1",
        }),
      );
    });

    it("вызывает onInsertPlaceholder с файлом", async () => {
      const onInsertPlaceholder = vi.fn();
      const file = makeFile();

      render(FileItem, {
        props: {
          file,
          onInsertPlaceholder,
        },
      });

      await fireEvent.click(
        screen.getByRole("button", {
          name: "Вставить ссылку на файл file.txt",
        }),
      );

      expect(onInsertPlaceholder).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "file-1",
        }),
      );
    });
  });
});