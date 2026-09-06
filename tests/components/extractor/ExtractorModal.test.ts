// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/svelte";
import "@testing-library/jest-dom/vitest";
import { get } from "svelte/store";

import ExtractorModal from "../../../src/components/extractor/ExtractorModal.svelte";
import { isExtractorOpen } from "../../../src/stores";
import {
  convertToAttachedFile,
  createZipBlob,
  downloadFile,
  extractFilesFromMarkdown,
} from "../../../src/utils/extractor";
import { addAttachmentsToProject } from "../../../src/utils/projectActions";
import type { ExtractedFile } from "../../../src/utils/extractor";

vi.mock("../../../src/utils/extractor", () => ({
  convertToAttachedFile: vi.fn(),
  createZipBlob: vi.fn(),
  downloadFile: vi.fn(),
  extractFilesFromMarkdown: vi.fn(),
}));

vi.mock("../../../src/utils/projectActions", () => ({
  addAttachmentsToProject: vi.fn(),
}));

function makeExtractedFile(
  overrides: Partial<ExtractedFile> = {},
): ExtractedFile {
  return {
    id: overrides.id ?? "ext-1",
    name: overrides.name ?? "script.py",
    lang: overrides.lang ?? "python",
    code: overrides.code ?? "print('hello')",
  };
}

describe("ExtractorModal", () => {
  beforeEach(() => {
    isExtractorOpen.set(false);

    vi.clearAllMocks();

    vi.mocked(extractFilesFromMarkdown).mockReturnValue([]);
    vi.mocked(convertToAttachedFile).mockReturnValue({
      id: "att-1",
      name: "script.py",
      size: 14,
      type: "text",
      content: "print('hello')",
      ext: "py",
    });
    vi.mocked(createZipBlob).mockReturnValue(new Blob(["zip"]));
    vi.mocked(addAttachmentsToProject).mockResolvedValue(undefined);
  });

  describe("Видимость", () => {
    it("не рендерится, когда isExtractorOpen=false", () => {
      render(ExtractorModal);

      expect(
        screen.queryByRole("dialog", { name: "Экстрактор кода" }),
      ).toBeNull();
    });

    it("рендерится, когда isExtractorOpen=true", async () => {
      isExtractorOpen.set(true);
      render(ExtractorModal);

      expect(
        await screen.findByRole("dialog", { name: "Экстрактор кода" }),
      ).toBeInTheDocument();
    });

    it("показывает заголовок", async () => {
      isExtractorOpen.set(true);
      render(ExtractorModal);

      expect(
        await screen.findByText("Smart Code Extractor"),
      ).toBeInTheDocument();
    });

    it("показывает описание", async () => {
      isExtractorOpen.set(true);
      render(ExtractorModal);

      expect(
        await screen.findByText("Извлечение файлов из markdown-ответов LLM"),
      ).toBeInTheDocument();
    });
  });

  describe("Извлечение файлов", () => {
    it("кнопка 'Распознать файлы' заблокирована при пустом вводе", async () => {
      isExtractorOpen.set(true);
      render(ExtractorModal);

      await screen.findByRole("dialog");

      const extractButton = screen.getByRole("button", {
        name: "Распознать файлы",
      });
      expect(extractButton).toBeDisabled();
    });

    it("кнопка 'Распознать файлы' активна при заполненном вводе", async () => {
      isExtractorOpen.set(true);
      render(ExtractorModal);

      await screen.findByRole("dialog");

      const textarea = screen.getByLabelText("Ответ LLM в формате Markdown");
      await fireEvent.input(textarea, {
        target: { value: "```python\nprint('hi')\n```" },
      });

      const extractButton = screen.getByRole("button", {
        name: "Распознать файлы",
      });
      expect(extractButton).toBeEnabled();
    });

    it("вызывает extractFilesFromMarkdown при распознавании", async () => {
      const markdown = "```python\nprint('hello')\n```";
      vi.mocked(extractFilesFromMarkdown).mockReturnValue([
        makeExtractedFile(),
      ]);

      isExtractorOpen.set(true);
      render(ExtractorModal);

      await screen.findByRole("dialog");

      const textarea = screen.getByLabelText("Ответ LLM в формате Markdown");
      await fireEvent.input(textarea, { target: { value: markdown } });

      await fireEvent.click(
        screen.getByRole("button", { name: "Распознать файлы" }),
      );

      expect(extractFilesFromMarkdown).toHaveBeenCalledWith(markdown);
    });

    it("показывает извлечённые файлы", async () => {
      vi.mocked(extractFilesFromMarkdown).mockReturnValue([
        makeExtractedFile({ name: "main.py", lang: "python" }),
      ]);

      isExtractorOpen.set(true);
      render(ExtractorModal);

      await screen.findByRole("dialog");

      const textarea = screen.getByLabelText("Ответ LLM в формате Markdown");
      await fireEvent.input(textarea, {
        target: { value: "```python\ncode\n```" },
      });

      await fireEvent.click(
        screen.getByRole("button", { name: "Распознать файлы" }),
      );

      expect(await screen.findByText("main.py")).toBeInTheDocument();
    });

    it("показывает пустое состояние, когда файлы не найдены", async () => {
      isExtractorOpen.set(true);
      render(ExtractorModal);

      await screen.findByRole("dialog");

      expect(screen.getByText("Файлы пока не найдены")).toBeInTheDocument();
    });
  });

  describe("Управление извлечёнными файлами", () => {
    async function extractFiles() {
      vi.mocked(extractFilesFromMarkdown).mockReturnValue([
        makeExtractedFile({ id: "f1", name: "a.py", code: "code1" }),
        makeExtractedFile({ id: "f2", name: "b.js", code: "code2" }),
      ]);

      isExtractorOpen.set(true);
      render(ExtractorModal);

      await screen.findByRole("dialog");

      const textarea = screen.getByLabelText("Ответ LLM в формате Markdown");
      await fireEvent.input(textarea, { target: { value: "some markdown" } });

      await fireEvent.click(
        screen.getByRole("button", { name: "Распознать файлы" }),
      );

      await screen.findByText("a.py");
    }

    it("показывает количество извлечённых файлов", async () => {
      await extractFiles();

      expect(screen.getByText("(2)")).toBeInTheDocument();
    });

    it("удаляет файл из списка", async () => {
      await extractFiles();

      // Кнопки в ExtractorModal не имеют aria-label, только title.
      // Ищем напрямую по атрибуту title.
      const deleteButtons = Array.from(
        document.querySelectorAll('button[title="Удалить"]'),
      );

      expect(deleteButtons.length).toBeGreaterThan(0);

      await fireEvent.click(deleteButtons[0]);

      await waitFor(() => {
        expect(screen.queryByText("a.py")).toBeNull();
      });

      expect(screen.getByText("b.js")).toBeInTheDocument();
    });

    it("показывает кнопку 'Скачать ZIP' при наличии файлов", async () => {
      await extractFiles();

      expect(
        screen.getByRole("button", { name: /Скачать ZIP/ }),
      ).toBeInTheDocument();
    });

    it("показывает кнопку 'Добавить в вложения' при наличии файлов", async () => {
      await extractFiles();

      expect(
        screen.getByRole("button", { name: /Добавить в вложения/ }),
      ).toBeInTheDocument();
    });
  });

  describe("Добавление в вложения", () => {
    it("вызывает addAttachmentsToProject и закрывает модалку", async () => {
      const extractedFile = makeExtractedFile();
      vi.mocked(extractFilesFromMarkdown).mockReturnValue([extractedFile]);

      const attachedFile = {
        id: "att-1",
        name: "script.py",
        size: 14,
        type: "text" as const,
        content: "print('hello')",
        ext: "py",
      };
      vi.mocked(convertToAttachedFile).mockReturnValue(attachedFile);

      isExtractorOpen.set(true);
      render(ExtractorModal);

      await screen.findByRole("dialog");

      const textarea = screen.getByLabelText("Ответ LLM в формате Markdown");
      await fireEvent.input(textarea, { target: { value: "markdown" } });

      await fireEvent.click(
        screen.getByRole("button", { name: "Распознать файлы" }),
      );

      await screen.findByText("script.py");

      await fireEvent.click(
        screen.getByRole("button", { name: /Добавить в вложения/ }),
      );

      await waitFor(() => {
        // .map() передаёт три аргумента: (element, index, array).
        // Проверяем только первый — сам файл.
        // vi.mocked() нужен, чтобы TypeScript знал о свойстве .mock.
        expect(vi.mocked(convertToAttachedFile).mock.calls[0][0]).toEqual(
          expect.objectContaining({ id: "ext-1", name: "script.py" }),
        );
        expect(addAttachmentsToProject).toHaveBeenCalledWith([attachedFile]);
        expect(get(isExtractorOpen)).toBe(false);
      });
    });
  });

  describe("Скачивание", () => {
    it("вызывает downloadFile при скачивании одного файла", async () => {
      vi.mocked(extractFilesFromMarkdown).mockReturnValue([
        makeExtractedFile({ name: "test.py", code: "print(1)" }),
      ]);

      isExtractorOpen.set(true);
      render(ExtractorModal);

      await screen.findByRole("dialog");

      const textarea = screen.getByLabelText("Ответ LLM в формате Markdown");
      await fireEvent.input(textarea, { target: { value: "md" } });

      await fireEvent.click(
        screen.getByRole("button", { name: "Распознать файлы" }),
      );

      await screen.findByText("test.py");

      const downloadButtons = Array.from(
        document.querySelectorAll('button[title="Скачать"]'),
      );
      await fireEvent.click(downloadButtons[0]);

      expect(downloadFile).toHaveBeenCalledWith("print(1)", "test.py");
    });
  });

  describe("Закрытие", () => {
    it("закрывается по кнопке закрытия", async () => {
      isExtractorOpen.set(true);
      render(ExtractorModal);

      await screen.findByRole("dialog");

      await fireEvent.click(screen.getByRole("button", { name: "Закрыть" }));

      await waitFor(() => {
        expect(get(isExtractorOpen)).toBe(false);
      });
    });

    it("закрывается по клику на фон", async () => {
      isExtractorOpen.set(true);
      render(ExtractorModal);

      const dialog = await screen.findByRole("dialog", {
        name: "Экстрактор кода",
      });

      await fireEvent.click(dialog);

      await waitFor(() => {
        expect(get(isExtractorOpen)).toBe(false);
      });
    });

    it("закрывается по Escape", async () => {
      isExtractorOpen.set(true);
      render(ExtractorModal);

      await screen.findByRole("dialog");

      await fireEvent.keyDown(window, { key: "Escape" });

      await waitFor(() => {
        expect(get(isExtractorOpen)).toBe(false);
      });
    });
  });
});
