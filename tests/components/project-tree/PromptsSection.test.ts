// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/svelte";
import "@testing-library/jest-dom/vitest";
import PromptsSection from "../../../src/components/project-tree/PromptsSection.svelte";
import { activeProject } from "../../../src/stores";
import { requestConfirm } from "../../../src/stores/confirm";
import { exportPromptsToZip } from "../../../src/utils/export/prompts";
import { notifyError, notifyUndo } from "$lib/notify";
import {
  createPromptFile,
  deletePromptFileWithUndo,
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
  deletePromptFileWithUndo: vi.fn(),
  deletePromptFiles: vi.fn(),
  flushPendingEditorSave: vi.fn().mockResolvedValue(undefined),
  isEmptyContent: (html: string) => html.replace(/<p><\/p>/g, "").trim() === "",
  pinPromptFile: vi.fn(),
  previewPromptFile: vi.fn(),
  renamePromptFile: vi.fn(),
}));

vi.mock("$lib/notify", () => ({
  notifyUndo: vi.fn(),
  notifyError: vi.fn(),
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

      expect(screen.getByText("Промпты")).toBeInTheDocument();
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
        name: /Промпты/,
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
        "prompt-1.md (клик — предпросмотр, двойной клик — закрепить, F2 — переименовать)",
      );

      await fireEvent.click(fileButton);

      expect(previewPromptFile).toHaveBeenCalledWith("1");
    });

    it("закрепляет файл по двойному клику", async () => {
      setProjectFiles([{ id: "1", name: "prompt-1.md" }]);

      render(PromptsSection);

      const fileButton = screen.getByTitle(
        "prompt-1.md (клик — предпросмотр, двойной клик — закрепить, F2 — переименовать)",
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
    // Промпт с текстом удаляется только после подтверждения,
    // отмена в уведомлении остаётся второй страховкой.
    const files = [
      { id: "1", name: "prompt-1.md", content: "<p>Привет</p>" },
      { id: "2", name: "prompt-2.md", content: "<p>Мир</p>" },
    ];

    it("спрашивает подтверждение и не удаляет при отказе", async () => {
      vi.mocked(requestConfirm).mockResolvedValue(false);
      setProjectFiles(files);
      render(PromptsSection);

      await fireEvent.click(
        screen.getByRole("button", { name: "Удалить файл prompt-1.md" }),
      );

      await waitFor(() => expect(requestConfirm).toHaveBeenCalledTimes(1));
      const options = vi.mocked(requestConfirm).mock.calls[0][0];
      expect(options.title).toBe("Удалить файл промпта?");
      expect(options.message).toContain("«prompt-1.md» (6 символов)");
      expect(options.danger).toBe(true);
      expect(deletePromptFileWithUndo).not.toHaveBeenCalled();
    });

    it("после подтверждения удаляет и предлагает отмену", async () => {
      const undo = vi.fn();
      vi.mocked(requestConfirm).mockResolvedValue(true);
      vi.mocked(deletePromptFileWithUndo).mockResolvedValue(undo);
      setProjectFiles(files);
      render(PromptsSection);

      await fireEvent.click(
        screen.getByRole("button", { name: "Удалить файл prompt-1.md" }),
      );

      await waitFor(() => {
        expect(deletePromptFileWithUndo).toHaveBeenCalledWith("1");
      });
      expect(notifyUndo).toHaveBeenCalledWith(
        "Файл «prompt-1.md» удалён",
        undo,
      );
    });

    it("пустой файл удаляет без вопроса", async () => {
      vi.mocked(deletePromptFileWithUndo).mockResolvedValue(vi.fn());
      setProjectFiles([
        { id: "1", name: "empty.md", content: "<p></p>" },
        ...files.slice(1),
      ]);
      render(PromptsSection);

      await fireEvent.click(
        screen.getByRole("button", { name: "Удалить файл empty.md" }),
      );

      await waitFor(() => {
        expect(deletePromptFileWithUndo).toHaveBeenCalledWith("1");
      });
      expect(requestConfirm).not.toHaveBeenCalled();
    });

    it("о последнем файле предупреждает, что появится пустой", async () => {
      vi.mocked(requestConfirm).mockResolvedValue(false);
      setProjectFiles([files[0]]);
      render(PromptsSection);

      await fireEvent.click(
        screen.getByRole("button", { name: "Удалить файл prompt-1.md" }),
      );

      await waitFor(() => expect(requestConfirm).toHaveBeenCalled());
      expect(vi.mocked(requestConfirm).mock.calls[0][0].message).toContain(
        "будет создан новый пустой файл",
      );
    });

    it("показывает ошибку, если удалить не удалось", async () => {
      vi.mocked(requestConfirm).mockResolvedValue(true);
      vi.mocked(deletePromptFileWithUndo).mockRejectedValue(
        new Error("db fail"),
      );
      setProjectFiles([files[0]]);
      render(PromptsSection);

      await fireEvent.click(
        screen.getByRole("button", { name: "Удалить файл prompt-1.md" }),
      );

      await waitFor(() => expect(notifyError).toHaveBeenCalledWith("db fail"));
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

    // Режим выбора (этап 8): чекбоксы у файлов появляются только в нём.
    async function enterManageMode() {
      await fireEvent.click(
        screen.getByRole("button", { name: "Выбрать файлы" }),
      );
    }

    async function selectFiles(...names: string[]) {
      for (const name of names) {
        await fireEvent.click(
          screen.getByRole("checkbox", { name: `Выбрать файл ${name}` }),
        );
      }
    }

    it("панель действий появляется в режиме выбора, кнопки неактивны без выбора", async () => {
      setProjectFiles(files);
      render(PromptsSection);

      expect(screen.queryByRole("toolbar")).toBeNull();
      await enterManageMode();

      expect(screen.getByRole("toolbar")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Удалить выбранные файлы" }),
      ).toBeDisabled();

      await selectFiles("one", "three");
      expect(screen.getByText("Выбрано 2")).toBeInTheDocument();
    });

    it("удаляет выбранные одним действием после подтверждения", async () => {
      vi.mocked(requestConfirm).mockResolvedValue(true);
      vi.mocked(deletePromptFiles).mockResolvedValue(true);
      setProjectFiles(files);
      render(PromptsSection);

      await enterManageMode();
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
      // Выбор снят, режим выбора остался: панель на месте, счётчика нет.
      await waitFor(() => expect(screen.queryByText("Выбрано 2")).toBeNull());
      expect(screen.getByRole("toolbar")).toBeInTheDocument();
    });

    it("не удаляет, если подтверждение отменено", async () => {
      vi.mocked(requestConfirm).mockResolvedValue(false);
      setProjectFiles(files);
      render(PromptsSection);

      await enterManageMode();
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

      await enterManageMode();
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

      await enterManageMode();
      await selectFiles("one");
      await fireEvent.click(
        screen.getByRole("checkbox", { name: "Выбрать все файлы" }),
      );

      expect(screen.getByText("Выбрано 3")).toBeInTheDocument();
    });

    it("выход из режима снимает выбор и прячет панель", async () => {
      setProjectFiles(files);
      render(PromptsSection);

      await enterManageMode();
      await selectFiles("one");
      await fireEvent.click(screen.getByRole("button", { name: "Готово" }));

      expect(screen.queryByRole("toolbar")).toBeNull();
      expect(
        screen.queryByRole("checkbox", { name: "Выбрать файл one" }),
      ).toBeNull();
    });
  });
});
