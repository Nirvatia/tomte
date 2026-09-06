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

import FileManagerModal from "../../../src/components/attachments/FileManagerModal.svelte";
import {
  activeProject,
  isFileManagerOpen,
  selectedFileIds,
} from "../../../src/stores";
import { requestConfirm } from "../../../src/stores/confirm";
import {
  formatFileSize,
  getErrorMessage,
  pluralize,
} from "../../../src/utils";
import { processFile } from "../../../src/utils/files";
import {
  addAttachmentsToProject,
  pruneSelectedFileIds,
  removeAttachmentFromProject,
  removeSelectedAttachmentsFromProject,
} from "../../../src/utils/projectActions";
import type { AttachedFile } from "../../../src/types";

vi.mock("../../../src/stores/confirm", () => ({
  requestConfirm: vi.fn(),
  requestAlert: vi.fn(),
}));

vi.mock("../../../src/utils", () => ({
  formatFileSize: vi.fn(),
  getErrorMessage: vi.fn(),
  pluralize: vi.fn(),
}));

vi.mock("../../../src/utils/files", () => ({
  processFile: vi.fn(),
  getPlaceholderPrefix: vi.fn((file: any) =>
    file.type === "image" ? "IMAGE" : "FILE",
  ),
  getPlaceholderIndex: vi.fn(() => 1),
}));

vi.mock("../../../src/utils/projectActions", () => ({
  addAttachmentsToProject: vi.fn(),
  pruneSelectedFileIds: vi.fn(),
  removeAttachmentFromProject: vi.fn(),
  removeSelectedAttachmentsFromProject: vi.fn(),
}));

vi.mock("$lib/actions/dropzone", () => ({
  dropzone: vi.fn(() => ({})),
}));

function makeAttachment(overrides: Partial<AttachedFile> = {}): AttachedFile {
  return {
    id: overrides.id ?? `file-${Math.random().toString(36).slice(2)}`,
    name: overrides.name ?? "file.txt",
    size: overrides.size ?? 10,
    type: overrides.type ?? "text",
    content: overrides.content ?? "content",
    ext: overrides.ext ?? "txt",
    dataUrl: overrides.dataUrl,
    width: overrides.width,
    height: overrides.height,
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

function openManager(attachments: AttachedFile[] = []) {
  setActiveProject(attachments);
  isFileManagerOpen.set(true);

  return render(FileManagerModal);
}

describe("FileManagerModal", () => {
  beforeEach(() => {
    activeProject.set(null);
    isFileManagerOpen.set(false);
    selectedFileIds.set(new Set());

    vi.clearAllMocks();

    vi.mocked(formatFileSize).mockReturnValue("1 КБ");
    vi.mocked(getErrorMessage).mockImplementation(
      (_error: any, fallback: string) => fallback,
    );
    vi.mocked(pluralize).mockReturnValue("файл");

    vi.mocked(requestConfirm).mockResolvedValue(false);
    vi.mocked(processFile).mockResolvedValue(
      makeAttachment({ id: "processed-1", name: "processed.txt" }),
    );
    vi.mocked(addAttachmentsToProject).mockResolvedValue(undefined as any);
    vi.mocked(pruneSelectedFileIds).mockReturnValue(undefined as any);
    vi.mocked(removeAttachmentFromProject).mockResolvedValue(undefined as any);
    vi.mocked(removeSelectedAttachmentsFromProject).mockResolvedValue(1);
  });

  describe("Видимость", () => {
    it("не рендерится, когда менеджер закрыт", () => {
      render(FileManagerModal);

      expect(
        screen.queryByRole("dialog", { name: "Менеджер файлов" }),
      ).toBeNull();
    });

    it("рендерится, когда менеджер открыт", async () => {
      openManager([]);

      expect(
        await screen.findByRole("dialog", { name: "Менеджер файлов" }),
      ).toBeInTheDocument();

      expect(screen.getByText("Менеджер файлов")).toBeInTheDocument();
    });

    it("вызывает pruneSelectedFileIds при открытии", async () => {
      openManager([]);

      await screen.findByRole("dialog", { name: "Менеджер файлов" });

      expect(pruneSelectedFileIds).toHaveBeenCalled();
    });
  });

  describe("Список файлов", () => {
    it("показывает пустое состояние, если файлов нет", async () => {
      openManager([]);

      expect(
        await screen.findByText("Нет загруженных файлов"),
      ).toBeInTheDocument();

      expect(
        await screen.findByText(
          "Закройте это окно и загрузите файлы в правом сайдбаре",
        ),
      ).toBeInTheDocument();
    });

    it("показывает список вложений", async () => {
      openManager([
        makeAttachment({ id: "1", name: "a.txt" }),
        makeAttachment({ id: "2", name: "b.txt" }),
      ]);

      await screen.findByText("a.txt");
      await screen.findByText("b.txt");

      expect(screen.getByText(/Всего:/)).toBeInTheDocument();
    });
  });

  describe("Выбор файлов", () => {
    it("выбирает все файлы", async () => {
      openManager([
        makeAttachment({ id: "1", name: "a.txt" }),
        makeAttachment({ id: "2", name: "b.txt" }),
      ]);

      await screen.findByText("a.txt");

      await fireEvent.click(
        screen.getByRole("button", { name: "Выбрать всё" }),
      );

      await waitFor(() => {
        expect(get(selectedFileIds)).toEqual(new Set(["1", "2"]));
      });

      expect(await screen.findByText(/Выбрано: 2/)).toBeInTheDocument();
    });

    it("снимает выделение со всех файлов", async () => {
      openManager([
        makeAttachment({ id: "1", name: "a.txt" }),
        makeAttachment({ id: "2", name: "b.txt" }),
      ]);

      await screen.findByText("a.txt");

      await fireEvent.click(
        screen.getByRole("button", { name: "Выбрать всё" }),
      );

      await waitFor(() => {
        expect(get(selectedFileIds)).toEqual(new Set(["1", "2"]));
      });

      await fireEvent.click(
        screen.getByRole("button", { name: "Снять выделение" }),
      );

      await waitFor(() => {
        expect(get(selectedFileIds)).toEqual(new Set());
      });
    });
  });

  describe("Удаление выбранных файлов", () => {
    it("блокирует кнопку удаления, если ничего не выбрано", async () => {
      openManager([makeAttachment({ id: "1", name: "a.txt" })]);

      await screen.findByText("a.txt");

      expect(
        screen.getByRole("button", { name: "Удалить выбранные" }),
      ).toBeDisabled();
    });

    it("удаляет выбранные файлы после подтверждения", async () => {
      vi.mocked(requestConfirm).mockResolvedValue(true);

      openManager([
        makeAttachment({ id: "1", name: "a.txt" }),
        makeAttachment({ id: "2", name: "b.txt" }),
      ]);

      await screen.findByText("a.txt");

      await fireEvent.click(
        screen.getByRole("button", { name: "Выбрать всё" }),
      );

      await waitFor(() => {
        expect(get(selectedFileIds)).toEqual(new Set(["1", "2"]));
      });

      await fireEvent.click(
        screen.getByRole("button", { name: "Удалить выбранные" }),
      );

      await waitFor(() => {
        expect(requestConfirm).toHaveBeenCalledWith(
          expect.objectContaining({
            title: "Удалить выбранные файлы?",
            danger: true,
          }),
        );
      });

      await waitFor(() => {
        expect(removeSelectedAttachmentsFromProject).toHaveBeenCalled();
      });
    });

    it("не удаляет выбранные файлы, если подтверждение отменено", async () => {
      vi.mocked(requestConfirm).mockResolvedValue(false);

      openManager([
        makeAttachment({ id: "1", name: "a.txt" }),
        makeAttachment({ id: "2", name: "b.txt" }),
      ]);

      await screen.findByText("a.txt");

      await fireEvent.click(
        screen.getByRole("button", { name: "Выбрать всё" }),
      );

      await waitFor(() => {
        expect(get(selectedFileIds)).toEqual(new Set(["1", "2"]));
      });

      await fireEvent.click(
        screen.getByRole("button", { name: "Удалить выбранные" }),
      );

      await waitFor(() => {
        expect(requestConfirm).toHaveBeenCalled();
      });

      expect(removeSelectedAttachmentsFromProject).not.toHaveBeenCalled();
    });
  });

  describe("Удаление одного файла", () => {
    it("удаляет файл через карточку файла", async () => {
      openManager([makeAttachment({ id: "single", name: "single.txt" })]);

      await screen.findByText("single.txt");

      await fireEvent.click(
        screen.getByRole("button", { name: "Удалить файл single.txt" }),
      );

      await waitFor(() => {
        expect(removeAttachmentFromProject).toHaveBeenCalledWith("single");
      });
    });

    it("показывает ошибку, если удаление одного файла не удалось", async () => {
      vi.mocked(removeAttachmentFromProject).mockRejectedValue(
        new Error("remove error"),
      );

      openManager([makeAttachment({ id: "single", name: "single.txt" })]);

      await screen.findByText("single.txt");

      await fireEvent.click(
        screen.getByRole("button", { name: "Удалить файл single.txt" }),
      );

      await screen.findByText("Не удалось удалить файл.");
    });
  });

  describe("Загрузка файлов", () => {
    it("загружает файлы через input", async () => {
      const { container } = openManager([]);

      await screen.findByText("Нет загруженных файлов");

      const input = container.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;

      const file = new File(["content"], "file.txt", {
        type: "text/plain",
      });

      vi.mocked(processFile).mockResolvedValue(
        makeAttachment({ id: "proc-1", name: "file.txt" }),
      );

      Object.defineProperty(input, "files", {
        value: [file],
        configurable: true,
      });

      await fireEvent.change(input);

      await waitFor(() => {
        expect(processFile).toHaveBeenCalledWith(file);
      });

      await waitFor(() => {
        expect(addAttachmentsToProject).toHaveBeenCalledWith([
          expect.objectContaining({ id: "proc-1" }),
        ]);
      });
    });

    it("показывает ошибку, если загрузка файлов не удалась", async () => {
      const { container } = openManager([]);

      await screen.findByText("Нет загруженных файлов");

      const input = container.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;

      const file = new File(["content"], "file.txt", {
        type: "text/plain",
      });

      vi.mocked(processFile).mockRejectedValue(new Error("upload error"));

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
      openManager([
        makeAttachment({
          id: "preview-1",
          name: "preview.txt",
          type: "text",
          content: "hello",
        }),
      ]);

      await screen.findByText("preview.txt");

      await fireEvent.click(
        screen.getByRole("button", { name: "Просмотреть файл preview.txt" }),
      );

      expect(
        await screen.findByRole("dialog", {
          name: "Просмотр файла preview.txt",
        }),
      ).toBeInTheDocument();
    });
  });

  describe("Закрытие модалки", () => {
    it("закрывается кнопкой закрытия", async () => {
      openManager([]);

      await screen.findByRole("dialog", { name: "Менеджер файлов" });

      await fireEvent.click(
        screen.getByRole("button", { name: "Закрыть менеджер файлов" }),
      );

      await waitFor(() => {
        expect(get(isFileManagerOpen)).toBe(false);
      });
    });

    it("закрывается по клику на фон", async () => {
      openManager([]);

      const dialog = await screen.findByRole("dialog", {
        name: "Менеджер файлов",
      });

      await fireEvent.click(dialog);

      await waitFor(() => {
        expect(get(isFileManagerOpen)).toBe(false);
      });
    });

    it("закрывается по Escape", async () => {
      openManager([]);

      await screen.findByRole("dialog", { name: "Менеджер файлов" });

      await fireEvent.keyDown(window, { key: "Escape" });

      await waitFor(() => {
        expect(get(isFileManagerOpen)).toBe(false);
      });
    });
  });
});