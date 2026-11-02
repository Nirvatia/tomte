// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/svelte";
import "@testing-library/jest-dom/vitest";

import TabsBar from "../../../src/components/editor/TabsBar.svelte";
import {
  activeProject,
  activeFileId,
  openFileIds,
  previewFileId,
} from "../../../src/stores";
import {
  activatePromptFile,
  closePromptFileTab,
  createPromptFile,
  renamePromptFile,
} from "../../../src/utils/projectActions";
import type { Project, PromptFile } from "../../../src/types";

vi.mock("../../../src/utils/projectActions", () => ({
  activatePromptFile: vi.fn(),
  closePromptFileTab: vi.fn(),
  createPromptFile: vi.fn(),
  renamePromptFile: vi.fn(),
  moveTab: vi.fn(),
  moveTabBy: vi.fn(),
}));

function makeFile(overrides: Partial<PromptFile> = {}): PromptFile {
  return {
    id: overrides.id ?? `file-${Math.random().toString(36).slice(2)}`,
    name: overrides.name ?? "main",
    content: overrides.content ?? "content",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function setProject(files: PromptFile[] = []) {
  activeProject.set({
    id: "project-1",
    name: "Test Project",
    files,
    attachments: [],
    totalSize: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as Project);
}

describe("TabsBar", () => {
  beforeEach(() => {
    activeProject.set(null);
    activeFileId.set(null);
    openFileIds.set([]);
    previewFileId.set(null);

    vi.clearAllMocks();

    vi.mocked(activatePromptFile).mockResolvedValue(undefined);
    vi.mocked(closePromptFileTab).mockResolvedValue(undefined);
    vi.mocked(createPromptFile).mockResolvedValue("new-file-id");
  });

  describe("Рендеринг вкладок", () => {
    it("показывает вкладки для открытых файлов", async () => {
      const file1 = makeFile({ id: "f1", name: "main" });
      const file2 = makeFile({ id: "f2", name: "second" });

      setProject([file1, file2]);
      openFileIds.set(["f1", "f2"]);
      activeFileId.set("f1");

      render(TabsBar);

      expect(await screen.findByText("main")).toBeInTheDocument();
      expect(screen.getByText("second")).toBeInTheDocument();
    });

    it("активная вкладка имеет aria-selected='true'", async () => {
      const file1 = makeFile({ id: "f1", name: "main" });
      const file2 = makeFile({ id: "f2", name: "second" });

      setProject([file1, file2]);
      openFileIds.set(["f1", "f2"]);
      activeFileId.set("f1");

      render(TabsBar);

      const activeTab = await screen.findByRole("tab", {
        name: "Вкладка main",
      });
      expect(activeTab).toHaveAttribute("aria-selected", "true");
    });

    it("неактивная вкладка имеет aria-selected='false'", async () => {
      const file1 = makeFile({ id: "f1", name: "main" });
      const file2 = makeFile({ id: "f2", name: "second" });

      setProject([file1, file2]);
      openFileIds.set(["f1", "f2"]);
      activeFileId.set("f1");

      render(TabsBar);

      const inactiveTab = await screen.findByRole("tab", {
        name: "Вкладка second",
      });
      expect(inactiveTab).toHaveAttribute("aria-selected", "false");
    });

    it("показывает вкладку предпросмотра, если она не закреплена", async () => {
      const file1 = makeFile({ id: "f1", name: "main" });
      const file2 = makeFile({ id: "f2", name: "preview" });

      setProject([file1, file2]);
      openFileIds.set(["f1"]);
      activeFileId.set("f1");
      previewFileId.set("f2");

      render(TabsBar);

      const previewTab = await screen.findByRole("tab", {
        name: /Вкладка preview \(предпросмотр\)/,
      });
      expect(previewTab).toBeInTheDocument();
    });

    it("показывает кнопку создания нового файла", () => {
      setProject([]);
      render(TabsBar);

      expect(
        screen.getByRole("button", {
          name: "Создать новый файл промпта",
        }),
      ).toBeInTheDocument();
    });
  });

  describe("Переключение вкладок", () => {
    it("вызывает activatePromptFile при клике на вкладку", async () => {
      const file1 = makeFile({ id: "f1", name: "main" });
      const file2 = makeFile({ id: "f2", name: "second" });

      setProject([file1, file2]);
      openFileIds.set(["f1", "f2"]);
      activeFileId.set("f1");

      render(TabsBar);

      const tab = await screen.findByRole("tab", {
        name: "Вкладка second",
      });
      await fireEvent.click(tab);

      expect(activatePromptFile).toHaveBeenCalledWith("f2");
    });
  });

  describe("Закрытие вкладок", () => {
    it("вызывает closePromptFileTab при клике на крестик", async () => {
      const file1 = makeFile({ id: "f1", name: "main" });

      setProject([file1]);
      openFileIds.set(["f1"]);
      activeFileId.set("f1");

      render(TabsBar);

      await screen.findByText("main");

      const closeButton = screen.getByRole("button", {
        name: "Закрыть вкладку main",
      });
      await fireEvent.click(closeButton);

      expect(closePromptFileTab).toHaveBeenCalledWith("f1");
    });
  });

  describe("Создание нового файла", () => {
    it("открывает форму создания по клику на плюс", async () => {
      const file1 = makeFile({ id: "f1", name: "main" });

      setProject([file1]);
      openFileIds.set(["f1"]);
      activeFileId.set("f1");

      render(TabsBar);

      await screen.findByText("main");

      const plusButton = screen.getByRole("button", {
        name: "Создать новый файл промпта",
      });
      await fireEvent.click(plusButton);

      const input = await screen.findByPlaceholderText("Имя файла...");
      expect(input).toBeInTheDocument();
    });

    it("предлагает уникальное имя для нового файла", async () => {
      const file1 = makeFile({ id: "f1", name: "main" });

      setProject([file1]);
      openFileIds.set(["f1"]);
      activeFileId.set("f1");

      render(TabsBar);

      await screen.findByText("main");

      const plusButton = screen.getByRole("button", {
        name: "Создать новый файл промпта",
      });
      await fireEvent.click(plusButton);

      const input = await screen.findByPlaceholderText("Имя файла...");
      expect(input).toHaveValue("prompt-1");
    });

    it("создаёт файл по Enter", async () => {
      setProject([]);
      render(TabsBar);

      const plusButton = screen.getByRole("button", {
        name: "Создать новый файл промпта",
      });
      await fireEvent.click(plusButton);

      const input = await screen.findByPlaceholderText("Имя файла...");
      await fireEvent.keyDown(input, { key: "Enter" });

      await waitFor(() => {
        expect(createPromptFile).toHaveBeenCalled();
      });
    });

    it("отменяет создание по Escape", async () => {
      setProject([]);
      render(TabsBar);

      const plusButton = screen.getByRole("button", {
        name: "Создать новый файл промпта",
      });
      await fireEvent.click(plusButton);

      const input = await screen.findByPlaceholderText("Имя файла...");
      await fireEvent.keyDown(input, { key: "Escape" });

      await waitFor(() => {
        expect(screen.queryByPlaceholderText("Имя файла...")).toBeNull();
      });

      expect(createPromptFile).not.toHaveBeenCalled();
    });
  });

  describe("Клавиатура", () => {
    it("Enter на вкладке переключает на файл", async () => {
      const file1 = makeFile({ id: "f1", name: "main" });
      const file2 = makeFile({ id: "f2", name: "second" });
      setProject([file1, file2]);
      openFileIds.set(["f1", "f2"]);
      activeFileId.set("f1");

      render(TabsBar);
      const tab = await screen.findByRole("tab", { name: "Вкладка second" });
      await fireEvent.keyDown(tab, { key: "Enter" });

      expect(activatePromptFile).toHaveBeenCalledWith("f2");
    });
  });

  describe("Переименование вкладки", () => {
    it("двойной клик открывает поле, Enter сохраняет имя", async () => {
      setProject([makeFile({ id: "f1", name: "main" })]);
      openFileIds.set(["f1"]);
      activeFileId.set("f1");
      render(TabsBar);

      await fireEvent.dblClick(
        await screen.findByRole("tab", { name: "Вкладка main" }),
      );
      const input = screen.getByRole("textbox", {
        name: "Новое имя файла main",
      });
      await fireEvent.input(input, { target: { value: "renamed" } });
      await fireEvent.keyDown(input, { key: "Enter" });

      expect(renamePromptFile).toHaveBeenCalledWith("f1", "renamed");
    });

    it("Escape отменяет переименование", async () => {
      setProject([makeFile({ id: "f1", name: "main" })]);
      openFileIds.set(["f1"]);
      activeFileId.set("f1");
      render(TabsBar);

      const tab = await screen.findByRole("tab", { name: "Вкладка main" });
      await fireEvent.keyDown(tab, { key: "F2" });
      const input = screen.getByRole("textbox", {
        name: "Новое имя файла main",
      });
      await fireEvent.keyDown(input, { key: "Escape" });

      expect(
        screen.queryByRole("textbox", { name: "Новое имя файла main" }),
      ).toBeNull();
      expect(renamePromptFile).not.toHaveBeenCalled();
    });
  });
});
