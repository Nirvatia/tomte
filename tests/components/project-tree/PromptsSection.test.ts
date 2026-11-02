// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/svelte";
import "@testing-library/jest-dom/vitest";
import PromptsSection from "../../../src/components/project-tree/PromptsSection.svelte";
import { activeProject } from "../../../src/stores";
import { requestConfirm } from "../../../src/stores/confirm";
import { exportPromptsToZip } from "../../../src/utils/export/prompts";
import {
  createPromptFile,
  deletePromptFile,
  deletePromptFiles,
  pinPromptFile,
  previewPromptFile,
  renamePromptFile,
} from "../../../src/utils/projectActions";

vi.mock("../../../src/stores/confirm", () => ({
  requestConfirm: vi.fn(),
  requestAlert: vi.fn(),
}));

vi.mock("../../../src/utils/projectActions", () => ({
  createPromptFile: vi.fn(),
  deletePromptFile: vi.fn(),
  deletePromptFiles: vi.fn(),
  flushPendingEditorSave: vi.fn().mockResolvedValue(undefined),
  pinPromptFile: vi.fn(),
  previewPromptFile: vi.fn(),
  renamePromptFile: vi.fn(),
}));

vi.mock("../../../src/utils/export/prompts", () => ({
  exportPromptsToZip: vi.fn(),
}));

function setProjectFiles(files: any[] = []) {
  activeProject.set({
    id: "project-1",
    name: "Test Project",
    files,
    attachments: [],
  } as any);
}

describe("PromptsSection", () => {
  beforeEach(() => {
    activeProject.set(null);
    vi.clearAllMocks();
  });

  describe("Рендеринг", () => {
    it("показывает заголовок и количество файлов", () => {
      setProjectFiles([
        { id: "1", name: "prompt-1.md" },
        { id: "2", name: "prompt-2.md" },
      ]);

      render(PromptsSection);

      expect(screen.getByText("Prompts")).toBeInTheDocument();
      expect(screen.getByText("2")).toBeInTheDocument();
      expect(screen.getByText("prompt-1.md")).toBeInTheDocument();
      expect(screen.getByText("prompt-2.md")).toBeInTheDocument();
    });

    it("показывает пустое состояние, если файлов нет", () => {
      setProjectFiles([]);

      render(PromptsSection);

      expect(screen.getByText("Нет файлов промптов")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /Создать файл/ }),
      ).toBeInTheDocument();
    });
  });

  describe("Сворачивание секции", () => {
    it("сворачивает и разворачивает список файлов", async () => {
      setProjectFiles([{ id: "1", name: "prompt-1.md" }]);

      render(PromptsSection);

      const headerButton = screen.getByRole("button", {
        name: /Prompts/,
      });

      await fireEvent.click(headerButton);

      expect(screen.queryByText("prompt-1.md")).toBeNull();

      await fireEvent.click(headerButton);

      expect(screen.getByText("prompt-1.md")).toBeInTheDocument();
    });
  });

  describe("Действия с файлами", () => {
    it("открывает предпросмотр файла по клику", async () => {
      setProjectFiles([{ id: "1", name: "prompt-1.md" }]);

      render(PromptsSection);

      const fileButton = screen.getByTitle(
        "prompt-1.md (клик — предпросмотр, двойной клик — закрепить)",
      );

      await fireEvent.click(fileButton);

      expect(previewPromptFile).toHaveBeenCalledWith("1");
    });

    it("закрепляет файл по двойному клику", async () => {
      setProjectFiles([{ id: "1", name: "prompt-1.md" }]);

      render(PromptsSection);

      const fileButton = screen.getByTitle(
        "prompt-1.md (клик — предпросмотр, двойной клик — закрепить)",
      );

      await fireEvent.dblClick(fileButton);

      expect(pinPromptFile).toHaveBeenCalledWith("1");
    });
  });

  describe("Переименование файла", () => {
    it("переименовывает файл по Enter", async () => {
      setProjectFiles([{ id: "1", name: "prompt-1.md" }]);

      render(PromptsSection);

      const renameButton = screen.getByRole("button", {
        name: "Переименовать файл prompt-1.md",
      });

      await fireEvent.click(renameButton);

      const input = screen.getByDisplayValue("prompt-1.md");

      await fireEvent.input(input, {
        target: { value: "renamed.md" },
      });

      await fireEvent.keyDown(input, { key: "Enter" });

      await waitFor(() => {
        expect(renamePromptFile).toHaveBeenCalledWith("1", "renamed.md");
      });
    });

    it("отменяет переименование по Escape", async () => {
      setProjectFiles([{ id: "1", name: "prompt-1.md" }]);

      render(PromptsSection);

      const renameButton = screen.getByRole("button", {
        name: "Переименовать файл prompt-1.md",
      });

      await fireEvent.click(renameButton);

      const input = screen.getByDisplayValue("prompt-1.md");

      await fireEvent.keyDown(input, { key: "Escape" });

      expect(renamePromptFile).not.toHaveBeenCalled();
      expect(screen.queryByDisplayValue("prompt-1.md")).toBeNull();
    });
  });

  describe("Удаление файла", () => {
    it("удаляет файл, если подтверждение принято", async () => {
      vi.mocked(requestConfirm).mockResolvedValue(true);

      setProjectFiles([
        { id: "1", name: "prompt-1.md" },
        { id: "2", name: "prompt-2.md" },
      ]);

      render(PromptsSection);

      const deleteButton = screen.getByRole("button", {
        name: "Удалить файл prompt-1.md",
      });

      await fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(deletePromptFile).toHaveBeenCalledWith("1");
      });
    });

    it("не удаляет файл, если подтверждение отменено", async () => {
      vi.mocked(requestConfirm).mockResolvedValue(false);

      setProjectFiles([
        { id: "1", name: "prompt-1.md" },
        { id: "2", name: "prompt-2.md" },
      ]);

      render(PromptsSection);

      const deleteButton = screen.getByRole("button", {
        name: "Удалить файл prompt-1.md",
      });

      await fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(deletePromptFile).not.toHaveBeenCalled();
      });
    });

    it("использует специальный заголовок для последнего файла", async () => {
      vi.mocked(requestConfirm).mockResolvedValue(false);

      setProjectFiles([{ id: "1", name: "only.md" }]);

      render(PromptsSection);

      const deleteButton = screen.getByRole("button", {
        name: "Удалить файл only.md",
      });

      await fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(requestConfirm).toHaveBeenCalledWith(
          expect.objectContaining({
            title: "Удалить последний файл?",
            danger: true,
          }),
        );
      });
    });
  });

  describe("Создание файла", () => {
    it("создаёт новый файл в пустом состоянии", async () => {
      setProjectFiles([]);

      render(PromptsSection);

      const createButton = screen.getByRole("button", {
        name: /Создать файл/,
      });

      await fireEvent.click(createButton);

      const input = await screen.findByPlaceholderText("Имя файла...");

      expect(input).toHaveValue("prompt-1");

      await fireEvent.input(input, {
        target: { value: "new-prompt" },
      });

      await fireEvent.keyDown(input, { key: "Enter" });

      await waitFor(() => {
        expect(createPromptFile).toHaveBeenCalledWith("new-prompt");
      });
    });
  });

  describe("Выбор нескольких файлов", () => {
    const files = [
      { id: "1", name: "one", content: "<p>1</p>" },
      { id: "2", name: "two", content: "<p>2</p>" },
      { id: "3", name: "three", content: "<p>3</p>" },
    ];

    async function selectFiles(...names: string[]) {
      for (const name of names) {
        await fireEvent.click(
          screen.getByRole("checkbox", { name: `Выбрать файл ${name}` }),
        );
      }
    }

    it("панель действий появляется только при выборе", async () => {
      setProjectFiles(files);
      render(PromptsSection);

      expect(screen.queryByRole("toolbar")).toBeNull();
      await selectFiles("one", "three");

      expect(screen.getByRole("toolbar")).toBeInTheDocument();
      expect(screen.getByText("Выбрано 2")).toBeInTheDocument();
    });

    it("удаляет выбранные одним действием после подтверждения", async () => {
      vi.mocked(requestConfirm).mockResolvedValue(true);
      vi.mocked(deletePromptFiles).mockResolvedValue(true);
      setProjectFiles(files);
      render(PromptsSection);

      await selectFiles("one", "three");
      await fireEvent.click(
        screen.getByRole("button", { name: "Удалить выбранные файлы" }),
      );

      await waitFor(() => {
        expect(deletePromptFiles).toHaveBeenCalledWith(["1", "3"]);
      });
      expect(requestConfirm).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Удалить 2 файла?" }),
      );
      await waitFor(() => expect(screen.queryByRole("toolbar")).toBeNull());
    });

    it("не удаляет, если подтверждение отменено", async () => {
      vi.mocked(requestConfirm).mockResolvedValue(false);
      setProjectFiles(files);
      render(PromptsSection);

      await selectFiles("two");
      await fireEvent.click(
        screen.getByRole("button", { name: "Удалить выбранные файлы" }),
      );

      await waitFor(() => expect(requestConfirm).toHaveBeenCalled());
      expect(deletePromptFiles).not.toHaveBeenCalled();
    });

    it("скачивает выбранные файлы ZIP-архивом", async () => {
      setProjectFiles(files);
      render(PromptsSection);

      await selectFiles("two", "three");
      await fireEvent.click(
        screen.getByRole("button", { name: "Скачать выбранные файлы как ZIP" }),
      );

      await waitFor(() => {
        expect(exportPromptsToZip).toHaveBeenCalledWith(
          [files[1], files[2]],
          "Test Project",
        );
      });
    });

    it("«выбрать все» выделяет все файлы", async () => {
      setProjectFiles(files);
      render(PromptsSection);

      await selectFiles("one");
      await fireEvent.click(
        screen.getByRole("checkbox", { name: "Выбрать все файлы" }),
      );

      expect(screen.getByText("Выбрано 3")).toBeInTheDocument();
    });
  });
});
