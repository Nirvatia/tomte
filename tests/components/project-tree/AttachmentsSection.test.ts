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
import AttachmentsSection from "../../../src/components/project-tree/AttachmentsSection.svelte";
import {
  activeProject,
  selectedFileIds,
  isFileManagerOpen,
} from "../../../src/stores";
import { requestConfirm } from "../../../src/stores/confirm";
import { processFile } from "../../../src/utils/files";
import {
  addAttachmentsToProject,
  removeAttachmentFromProject,
  removeAttachmentsFromProject,
} from "../../../src/utils/projectActions";

vi.mock("$lib/actions/dropzone", () => ({
  dropzone: vi.fn(() => ({})),
}));

vi.mock("../../../src/stores/confirm", () => ({
  requestConfirm: vi.fn(),
  requestAlert: vi.fn(),
}));

vi.mock("../../../src/utils/files", () => ({
  processFile: vi.fn(),
}));

vi.mock("../../../src/utils/index", () => ({
  getErrorMessage: vi.fn((_error, fallback) => fallback),
  pluralize: vi.fn(() => "файл"),
}));

vi.mock("../../../src/utils/projectActions", () => ({
  addAttachmentsToProject: vi.fn(),
  removeAttachmentFromProject: vi.fn(),
  removeAttachmentsFromProject: vi.fn(),
}));

vi.mock(
  "../../../src/components/attachments/FileItem.svelte",
  async () => {
    const { default: FileItemMock } = await import(
      "../../mocks/FileItem.mock.svelte"
    );

    return {
      default: FileItemMock,
    };
  },
);

vi.mock(
  "../../../src/components/attachments/FilePreviewModal.svelte",
  async () => {
    const { default: FilePreviewModalMock } = await import(
      "../../mocks/FilePreviewModal.mock.svelte"
    );

    return {
      default: FilePreviewModalMock,
    };
  },
);

function setProjectAttachments(attachments: any[] = []) {
  activeProject.set({
    id: "project-1",
    name: "Test Project",
    files: [],
    attachments,
  } as any);
}

describe("AttachmentsSection", () => {
  beforeEach(() => {
    activeProject.set(null);
    selectedFileIds.set(new Set());
    isFileManagerOpen.set(false);

    vi.clearAllMocks();
  });

  describe("Рендеринг", () => {
    it("показывает пустое состояние, если вложений нет", () => {
      setProjectAttachments([]);

      render(AttachmentsSection);

      expect(screen.getByText("Attachments")).toBeInTheDocument();
      expect(screen.getByText("Нет вложений")).toBeInTheDocument();
      expect(
        screen.getByText("Загрузите файлы или перетащите их сюда"),
      ).toBeInTheDocument();
    });

    it("показывает список вложений и счётчик", () => {
      setProjectAttachments([
        { id: "1", name: "a.txt", size: 10, type: "text" },
        { id: "2", name: "b.txt", size: 20, type: "text" },
      ]);

      render(AttachmentsSection);

      expect(screen.getByText("Attachments")).toBeInTheDocument();
      expect(screen.getByText("2")).toBeInTheDocument();
      expect(screen.getByText("a.txt")).toBeInTheDocument();
      expect(screen.getByText("b.txt")).toBeInTheDocument();
    });
  });

  describe("Выбор всех вложений", () => {
    it("выбирает и снимает выбор всех вложений", async () => {
      setProjectAttachments([
        { id: "1", name: "a.txt", size: 10, type: "text" },
        { id: "2", name: "b.txt", size: 20, type: "text" },
      ]);

      render(AttachmentsSection);

      const selectAllCheckbox = screen.getByRole("checkbox", {
        name: "Выбрать все вложения",
      });

      await fireEvent.click(selectAllCheckbox);

      expect(get(selectedFileIds)).toEqual(new Set(["1", "2"]));

      await fireEvent.click(selectAllCheckbox);

      expect(get(selectedFileIds)).toEqual(new Set());
    });
  });

  describe("Удаление вложений", () => {
    it("удаляет одно вложение", async () => {
      setProjectAttachments([
        { id: "1", name: "a.txt", size: 10, type: "text" },
      ]);

      render(AttachmentsSection);

      const removeButton = screen.getByRole("button", {
        name: "Удалить a.txt",
      });

      await fireEvent.click(removeButton);

      await waitFor(() => {
        expect(removeAttachmentFromProject).toHaveBeenCalledWith("1");
      });
    });

    it("удаляет выбранные вложения после подтверждения", async () => {
      vi.mocked(requestConfirm).mockResolvedValue(true);

      setProjectAttachments([
        { id: "1", name: "a.txt", size: 10, type: "text" },
        { id: "2", name: "b.txt", size: 20, type: "text" },
      ]);

      selectedFileIds.set(new Set(["1"]));

      render(AttachmentsSection);

      const deleteSelectedButton = screen.getByRole("button", {
        name: "Удалить выбранные вложения",
      });

      await fireEvent.click(deleteSelectedButton);

      await waitFor(() => {
        expect(removeAttachmentsFromProject).toHaveBeenCalledWith(
          new Set(["1"]),
        );
      });
    });

    it("не удаляет выбранные вложения, если подтверждение отменено", async () => {
      vi.mocked(requestConfirm).mockResolvedValue(false);

      setProjectAttachments([
        { id: "1", name: "a.txt", size: 10, type: "text" },
      ]);

      selectedFileIds.set(new Set(["1"]));

      render(AttachmentsSection);

      const deleteSelectedButton = screen.getByRole("button", {
        name: "Удалить выбранные вложения",
      });

      await fireEvent.click(deleteSelectedButton);

      await waitFor(() => {
        expect(removeAttachmentsFromProject).not.toHaveBeenCalled();
      });
    });
  });

  describe("Менеджер файлов", () => {
    it("открывает менеджер файлов", async () => {
      setProjectAttachments([
        { id: "1", name: "a.txt", size: 10, type: "text" },
      ]);

      render(AttachmentsSection);

      const openManagerButton = screen.getByRole("button", {
        name: "Открыть менеджер файлов",
      });

      await fireEvent.click(openManagerButton);

      expect(get(isFileManagerOpen)).toBe(true);
    });
  });

  describe("Загрузка файлов", () => {
    it("загружает файлы через input", async () => {
      setProjectAttachments([]);

      vi.mocked(processFile).mockResolvedValue({
        id: "processed-1",
        name: "file.txt",
        size: 10,
        type: "text",
      } as any);

      const { container } = render(AttachmentsSection);

      const input = container.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;

      const file = new File(["content"], "file.txt", {
        type: "text/plain",
      });

      Object.defineProperty(input, "files", {
        value: [file],
        configurable: true,
      });

      await fireEvent.change(input);

      await waitFor(() => {
        expect(processFile).toHaveBeenCalledWith(file);
      });

      await waitFor(() => {
        expect(addAttachmentsToProject).toHaveBeenCalled();
      });
    });

    it("показывает ошибку, если загрузка не удалась", async () => {
      setProjectAttachments([]);

      vi.mocked(processFile).mockRejectedValue(new Error("upload error"));

      const { container } = render(AttachmentsSection);

      const input = container.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;

      const file = new File(["content"], "file.txt", {
        type: "text/plain",
      });

      Object.defineProperty(input, "files", {
        value: [file],
        configurable: true,
      });

      await fireEvent.change(input);

      await screen.findByText("Не удалось добавить файлы.");
    });
  });

  describe("Предпросмотр файла", () => {
    it("открывает предпросмотр файла", async () => {
      setProjectAttachments([
        { id: "1", name: "a.txt", size: 10, type: "text" },
      ]);

      render(AttachmentsSection);

      const previewButton = screen.getByRole("button", {
        name: "Открыть превью a.txt",
      });

      await fireEvent.click(previewButton);

      await screen.findByRole("dialog", {
        name: "Превью a.txt",
      });
    });
  });
});