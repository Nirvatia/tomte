// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/svelte";
import "@testing-library/jest-dom/vitest";

import FilePreviewModal from "../../../src/components/attachments/FilePreviewModal.svelte";
import type { AttachedFile } from "../../../src/types";

function makeFile(overrides: Partial<AttachedFile> = {}): AttachedFile {
  return {
    id: "file-1",
    name: "file.txt",
    size: 10,
    type: "text",
    content: "text content",
    ext: "txt",
    ...overrides,
  };
}

describe("FilePreviewModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Видимость", () => {
    it("не рендерится, если файл не передан", () => {
      render(FilePreviewModal, {
        props: {
          file: null,
        },
      });

      expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("рендерится, если файл передан", async () => {
      const file = makeFile({ name: "report.txt" });

      render(FilePreviewModal, {
        props: {
          file,
        },
      });

      expect(
        await screen.findByRole("dialog", {
          name: "Просмотр файла report.txt",
        }),
      ).toBeInTheDocument();
    });
  });

  describe("Контент", () => {
    it("показывает имя файла", () => {
      const file = makeFile({ name: "report.txt" });

      render(FilePreviewModal, {
        props: {
          file,
        },
      });

      expect(screen.getByText("report.txt")).toBeInTheDocument();
    });

    it("показывает тип и размер текстового файла", () => {
      const file = makeFile({
        type: "text",
        size: 10,
      });

      render(FilePreviewModal, {
        props: {
          file,
        },
      });

      expect(screen.getByText(/Текстовый файл/)).toBeInTheDocument();
      expect(screen.getByText(/10 байт/)).toBeInTheDocument();
    });

    it("показывает тип изображения", () => {
      const file = makeFile({
        type: "image",
        dataUrl: "data:image/png;base64,AAA",
        name: "img.png",
      });

      render(FilePreviewModal, {
        props: {
          file,
        },
      });

      expect(screen.getByText(/Изображение/)).toBeInTheDocument();
    });

    it("рендерит изображение, если есть dataUrl", () => {
      const file = makeFile({
        type: "image",
        dataUrl: "data:image/png;base64,AAA",
        name: "img.png",
      });

      render(FilePreviewModal, {
        props: {
          file,
        },
      });

      const img = screen.getByRole("img", { name: "img.png" });

      expect(img).toHaveAttribute("src", "data:image/png;base64,AAA");
    });

    it("рендерит текстовое содержимое", () => {
      const file = makeFile({
        type: "text",
        content: "Hello world",
      });

      render(FilePreviewModal, {
        props: {
          file,
        },
      });

      expect(screen.getByText("Hello world")).toBeInTheDocument();
    });

    it("показывает заглушку, если содержимое недоступно", () => {
      const file = makeFile({
        type: "text",
        content: undefined,
      });

      render(FilePreviewModal, {
        props: {
          file,
        },
      });

      expect(screen.getByText("Содержимое недоступно")).toBeInTheDocument();
    });
  });

  describe("Закрытие", () => {
    it("закрывается по кнопке закрытия", async () => {
      const onClose = vi.fn();
      const file = makeFile();

      render(FilePreviewModal, {
        props: {
          file,
          onClose,
        },
      });

      await fireEvent.click(
        screen.getByRole("button", { name: "Закрыть просмотр файла" }),
      );

      expect(onClose).toHaveBeenCalled();
    });

    it("закрывается по клику на фон", async () => {
      const onClose = vi.fn();
      const file = makeFile();

      render(FilePreviewModal, {
        props: {
          file,
          onClose,
        },
      });

      const dialog = await screen.findByRole("dialog", {
        name: "Просмотр файла file.txt",
      });

      await fireEvent.click(dialog);

      expect(onClose).toHaveBeenCalled();
    });

    it("закрывается по Escape", async () => {
      const onClose = vi.fn();
      const file = makeFile();

      render(FilePreviewModal, {
        props: {
          file,
          onClose,
        },
      });

      await fireEvent.keyDown(window, { key: "Escape" });

      expect(onClose).toHaveBeenCalled();
    });

    it("не вызывает onClose, если файл не открыт", async () => {
      const onClose = vi.fn();

      render(FilePreviewModal, {
        props: {
          file: null,
          onClose,
        },
      });

      await fireEvent.keyDown(window, { key: "Escape" });

      expect(onClose).not.toHaveBeenCalled();
    });
  });
});