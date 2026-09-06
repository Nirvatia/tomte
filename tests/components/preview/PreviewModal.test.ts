// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
} from "@testing-library/svelte";
import "@testing-library/jest-dom/vitest";
import { get } from "svelte/store";

import PreviewModal from "../../../src/components/preview/PreviewModal.svelte";
import { activeProject, isPreviewOpen } from "../../../src/stores";
import { buildPreviewHtml } from "../../../src/utils/preview";
import type { AttachedFile } from "../../../src/types";

vi.mock("../../../src/utils/preview", () => ({
  buildPreviewHtml: vi.fn(),
}));

function makeAttachment(overrides: Partial<AttachedFile> = {}): AttachedFile {
  return {
    id: overrides.id ?? "att-1",
    name: overrides.name ?? "file.txt",
    size: overrides.size ?? 100,
    type: overrides.type ?? "text",
    content: overrides.content,
    dataUrl: overrides.dataUrl,
    ext: overrides.ext ?? "txt",
  };
}

function setActiveProject(attachments: AttachedFile[] = []) {
  activeProject.set({
    id: "project-1",
    name: "Test Project",
    files: [],
    attachments,
    totalSize: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as any);
}

describe("PreviewModal", () => {
  beforeEach(() => {
    activeProject.set(null);
    isPreviewOpen.set(false);

    vi.clearAllMocks();

    vi.mocked(buildPreviewHtml).mockReturnValue({
      html: "<p>Preview content</p>",
      stats: {
        totalFiles: 2,
        usedImages: 1,
        unusedImages: 0,
        usedFiles: 1,
        attachedTexts: 0,
      },
    } as any);
  });

  describe("Видимость", () => {
    it("не рендерится, когда isPreviewOpen=false", () => {
      render(PreviewModal, { props: { editorHtml: "<p>text</p>" } });

      expect(
        screen.queryByRole("dialog", { name: "Предпросмотр промпта" }),
      ).toBeNull();
    });

    it("рендерится, когда isPreviewOpen=true", async () => {
      isPreviewOpen.set(true);
      render(PreviewModal, { props: { editorHtml: "<p>text</p>" } });

      expect(
        await screen.findByRole("dialog", { name: "Предпросмотр промпта" }),
      ).toBeInTheDocument();
    });

    it("показывает заголовок", async () => {
      isPreviewOpen.set(true);
      render(PreviewModal, { props: { editorHtml: "<p>text</p>" } });

      expect(
        await screen.findByText("Предпросмотр финального промпта"),
      ).toBeInTheDocument();
    });
  });

  describe("Статистика", () => {
    it("показывает общее количество файлов", async () => {
      isPreviewOpen.set(true);
      render(PreviewModal, { props: { editorHtml: "<p>text</p>" } });

      await screen.findByRole("dialog");
      expect(screen.getByText("Файлов:")).toBeInTheDocument();
    });

    it("показывает количество использованных изображений", async () => {
      isPreviewOpen.set(true);
      render(PreviewModal, { props: { editorHtml: "<p>text</p>" } });

      await screen.findByRole("dialog");
      expect(screen.getByText(/Изображений использовано:/)).toBeInTheDocument();
    });

    it("показывает предупреждение о неиспользованных изображениях", async () => {
      vi.mocked(buildPreviewHtml).mockReturnValue({
        html: "<p>Content</p>",
        stats: {
          totalFiles: 3,
          usedImages: 1,
          unusedImages: 2,
          usedFiles: 0,
          attachedTexts: 0,
        },
      } as any);

      isPreviewOpen.set(true);
      render(PreviewModal, { props: { editorHtml: "<p>text</p>" } });

      await screen.findByRole("dialog");
      expect(screen.getByText(/Без плейсхолдера:/)).toBeInTheDocument();
    });

    it("не показывает предупреждение, если неиспользованных изображений нет", async () => {
      isPreviewOpen.set(true);
      render(PreviewModal, { props: { editorHtml: "<p>text</p>" } });

      await screen.findByRole("dialog");
      expect(screen.queryByText(/Без плейсхолдера:/)).toBeNull();
    });

    it("показывает количество прикреплённых текстов", async () => {
      vi.mocked(buildPreviewHtml).mockReturnValue({
        html: "<p>Content</p>",
        stats: {
          totalFiles: 2,
          usedImages: 0,
          unusedImages: 0,
          usedFiles: 1,
          attachedTexts: 1,
        },
      } as any);

      isPreviewOpen.set(true);
      render(PreviewModal, { props: { editorHtml: "<p>text</p>" } });

      await screen.findByRole("dialog");
      expect(screen.getByText(/Прикреплено в конец:/)).toBeInTheDocument();
    });
  });

  describe("Контент", () => {
    it("рендерит HTML из buildPreviewHtml", async () => {
      isPreviewOpen.set(true);
      render(PreviewModal, { props: { editorHtml: "<p>text</p>" } });

      await screen.findByRole("dialog");
      expect(screen.getByText("Preview content")).toBeInTheDocument();
    });

    it("показывает пустое состояние, когда нет контента и файлов", async () => {
      vi.mocked(buildPreviewHtml).mockReturnValue({
        html: "",
        stats: {
          totalFiles: 0,
          usedImages: 0,
          unusedImages: 0,
          usedFiles: 0,
          attachedTexts: 0,
        },
      } as any);

      isPreviewOpen.set(true);
      render(PreviewModal, { props: { editorHtml: "" } });

      await screen.findByRole("dialog");
      expect(screen.getByText("Нечего просматривать")).toBeInTheDocument();
    });

    it("не показывает пустое состояние, когда есть контент", async () => {
      isPreviewOpen.set(true);
      render(PreviewModal, { props: { editorHtml: "<p>text</p>" } });

      await screen.findByRole("dialog");
      expect(screen.queryByText("Нечего просматривать")).toBeNull();
    });
  });

  describe("Закрытие", () => {
    it("закрывается по кнопке закрытия", async () => {
      isPreviewOpen.set(true);
      render(PreviewModal, { props: { editorHtml: "<p>text</p>" } });

      await screen.findByRole("dialog");

      await fireEvent.click(
        screen.getByRole("button", { name: "Закрыть предпросмотр" }),
      );

      await waitFor(() => {
        expect(get(isPreviewOpen)).toBe(false);
      });
    });

    it("закрывается по клику на фон", async () => {
      isPreviewOpen.set(true);
      render(PreviewModal, { props: { editorHtml: "<p>text</p>" } });

      const dialog = await screen.findByRole("dialog", {
        name: "Предпросмотр промпта",
      });

      await fireEvent.click(dialog);

      await waitFor(() => {
        expect(get(isPreviewOpen)).toBe(false);
      });
    });

    it("закрывается по Escape", async () => {
      isPreviewOpen.set(true);
      render(PreviewModal, { props: { editorHtml: "<p>text</p>" } });

      await screen.findByRole("dialog");

      await fireEvent.keyDown(window, { key: "Escape" });

      await waitFor(() => {
        expect(get(isPreviewOpen)).toBe(false);
      });
    });
  });

  describe("Интеграция с вложениями", () => {
    it("передаёт вложения из проекта в buildPreviewHtml", async () => {
      const attachments = [
        makeAttachment({ id: "a1", name: "img.png", type: "image" }),
      ];
      setActiveProject(attachments);

      isPreviewOpen.set(true);
      render(PreviewModal, { props: { editorHtml: "<p>text</p>" } });

      await screen.findByRole("dialog");

      expect(buildPreviewHtml).toHaveBeenCalledWith("<p>text</p>", attachments);
    });
  });
});