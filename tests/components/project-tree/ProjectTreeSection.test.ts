// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/svelte";
import "@testing-library/jest-dom/vitest";
import { tick } from "svelte";
import { get } from "svelte/store";
import ProjectTreeSection from "../../../src/components/project-tree/ProjectTreeSection.svelte";
import {
  activeProject,
  projectTreeString,
  selectedProjectFiles,
} from "../../../src/stores";
import { setActiveTree } from "../../helpers/project";
import {
  clearGithubConfig,
  restoreGithubTree,
  setProjectTreeSource,
} from "../../../src/utils/projectActions";
import {
  calculateStats,
  hasFileSystemAccess,
  readDirectoryRecursive,
} from "../../../src/utils/projectTree";

vi.mock("$app/environment", () => ({
  browser: true,
}));

vi.mock("$lib/actions/directoryPicker", () => ({
  directoryPicker: vi.fn(() => ({})),
}));

vi.mock("../../../src/stores/confirm", () => ({
  requestConfirm: vi.fn(),
  requestAlert: vi.fn(),
}));

vi.mock("../../../src/utils/github", () => ({
  fetchGithubFileContent: vi.fn(),
}));

vi.mock("../../../src/utils/projectActions", () => ({
  clearGithubConfig: vi.fn(),
  restoreGithubTree: vi.fn(),
  setProjectTreeSource: vi.fn(),
}));

vi.mock("../../../src/utils/projectTree", async (importOriginal) => ({
  // filterTree настоящий: поиск проверяем вместе с компонентом.
  filterTree: (
    await importOriginal<typeof import("../../../src/utils/projectTree")>()
  ).filterTree,
  calculateStats: vi.fn(),
  hasFileSystemAccess: vi.fn(),
  readDirectoryRecursive: vi.fn(),
  readDirectoryViaInput: vi.fn(),
}));

function makeEditorMock() {
  const run = vi.fn();
  const insertProjectTree = vi.fn(() => ({ run }));
  const focus = vi.fn(() => ({ insertProjectTree }));
  const chain = vi.fn(() => ({ focus }));

  return { chain, focus, insertProjectTree, run };
}

describe("ProjectTreeSection", () => {
  beforeEach(() => {
    activeProject.set(null);
    selectedProjectFiles.set([]);

    vi.clearAllMocks();

    vi.mocked(calculateStats).mockReturnValue({
      totalFiles: 0,
      totalDirs: 0,
      rootName: "",
    });

    vi.mocked(hasFileSystemAccess).mockReturnValue(false);
  });

  afterEach(() => {
    delete (window as any).showDirectoryPicker;
  });

  describe("Рендеринг", () => {
    it("показывает пустое состояние, если дерево не создано", () => {
      render(ProjectTreeSection);

      expect(screen.getByText("Проект")).toBeInTheDocument();
      expect(screen.getByText("Дерево не создано")).toBeInTheDocument();
      expect(
        screen.getByText("Откройте папку или подключите GitHub-репозиторий"),
      ).toBeInTheDocument();
    });

    it("показывает корень и файлы дерева", () => {
      setActiveTree(
        [
          {
            name: "file.txt",
            path: "file.txt",
            type: "file",
            children: [],
          },
        ] as any,
        "my-project",
      );

      vi.mocked(calculateStats).mockReturnValue({
        totalFiles: 1,
        totalDirs: 0,
        rootName: "",
      });

      render(ProjectTreeSection);

      expect(screen.getByText("my-project")).toBeInTheDocument();
      expect(screen.getByText("file.txt")).toBeInTheDocument();
      expect(screen.getByText("1")).toBeInTheDocument();
    });
  });

  describe("Выбор всех файлов", () => {
    it("выбирает и снимает выбор всех файлов", async () => {
      setActiveTree([
        {
          name: "src",
          path: "src",
          type: "directory",
          children: [
            {
              name: "a.ts",
              path: "src/a.ts",
              type: "file",
              children: [],
            },
          ],
        },
        {
          name: "b.md",
          path: "b.md",
          type: "file",
          children: [],
        },
      ] as any);

      vi.mocked(calculateStats).mockReturnValue({
        totalFiles: 2,
        totalDirs: 1,
        rootName: "",
      });

      render(ProjectTreeSection);

      const selectAllCheckbox = screen.getByRole("checkbox", {
        name: "Выбрать все файлы дерева",
      });

      await fireEvent.click(selectAllCheckbox);

      expect(get(selectedProjectFiles).sort()).toEqual(["b.md", "src/a.ts"]);

      await fireEvent.click(selectAllCheckbox);

      expect(get(selectedProjectFiles)).toEqual([]);
    });
  });

  describe("Копирование дерева", () => {
    it("копирует строку дерева в буфер обмена", async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);

      Object.defineProperty(navigator, "clipboard", {
        value: { writeText },
        configurable: true,
      });

      setActiveTree([], "project");

      render(ProjectTreeSection);

      const copyButton = screen.getByRole("button", {
        name: "Копировать дерево",
      });

      await fireEvent.click(copyButton);

      expect(writeText).toHaveBeenCalledWith(get(projectTreeString));
    });
  });

  describe("Вставка дерева в редактор", () => {
    it("вставляет дерево в редактор отдельным блоком", async () => {
      const editor = makeEditorMock();

      setActiveTree([], "project");

      render(ProjectTreeSection, {
        props: {
          editor: editor as any,
        },
      });

      const insertButton = screen.getByRole("button", {
        name: "Вставить дерево в редактор",
      });

      await fireEvent.click(insertButton);

      expect(editor.chain).toHaveBeenCalled();
      expect(editor.focus).toHaveBeenCalled();
      expect(editor.insertProjectTree).toHaveBeenCalledWith(
        get(projectTreeString),
      );
      expect(editor.run).toHaveBeenCalled();
    });
  });

  describe("GitHub", () => {
    it("открывает GitHub-модалку по кнопке", async () => {
      const onOpenGithubModal = vi.fn();

      render(ProjectTreeSection, {
        props: {
          onOpenGithubModal,
        },
      });

      const githubButton = screen.getByRole("button", {
        name: "Подключить GitHub",
      });

      await fireEvent.click(githubButton);

      expect(onOpenGithubModal).toHaveBeenCalled();
    });

    it("восстанавливает GitHub-репозиторий, если есть сохранённая конфигурация", async () => {
      activeProject.set({
        githubConfig: {
          owner: "owner",
          repo: "repo",
        },
      } as any);

      vi.mocked(restoreGithubTree).mockResolvedValue(true);

      render(ProjectTreeSection);

      const restoreButton = await screen.findByRole("button", {
        name: "Восстановить GitHub репо",
      });

      await fireEvent.click(restoreButton);

      await waitFor(() => {
        expect(restoreGithubTree).toHaveBeenCalled();
      });
    });

    it("показывает ошибку, если восстановить репозиторий не удалось", async () => {
      activeProject.set({
        githubConfig: {
          owner: "owner",
          repo: "repo",
        },
      } as any);

      vi.mocked(restoreGithubTree).mockResolvedValue(false);

      render(ProjectTreeSection);

      const restoreButton = await screen.findByRole("button", {
        name: "Восстановить GitHub репо",
      });

      await fireEvent.click(restoreButton);

      await screen.findByText("Не удалось восстановить репозиторий");
    });
  });

  describe("Открытие папки", () => {
    it("использует File System Access API, если он доступен", async () => {
      vi.mocked(hasFileSystemAccess).mockReturnValue(true);

      const nodes = [
        {
          name: "a.txt",
          path: "a.txt",
          type: "file",
          children: [],
        },
      ];

      vi.mocked(readDirectoryRecursive).mockResolvedValue(nodes as any);

      vi.mocked(calculateStats).mockReturnValue({
        totalFiles: 1,
        totalDirs: 0,
        rootName: "",
      });

      vi.mocked(setProjectTreeSource).mockResolvedValue(true);

      (window as any).showDirectoryPicker = vi.fn().mockResolvedValue({
        name: "my-dir",
      });

      render(ProjectTreeSection);

      await tick();

      const openFolderButton = screen.getByRole("button", {
        name: "Открыть папку",
      });

      await fireEvent.click(openFolderButton);

      await waitFor(() => {
        expect(setProjectTreeSource).toHaveBeenCalledWith({
          rootName: "my-dir",
          nodes,
          fileCount: 1,
        });
      });

      await waitFor(() => {
        expect(clearGithubConfig).toHaveBeenCalled();
      });
    });
  });

  describe("Поиск по дереву", () => {
    const nodes = [
      {
        name: "src",
        path: "src",
        type: "directory",
        children: [
          { name: "api.ts", path: "src/api.ts", type: "file", children: [] },
          { name: "main.ts", path: "src/main.ts", type: "file", children: [] },
        ],
      },
      { name: "README.md", path: "README.md", type: "file", children: [] },
    ];

    it("показывает только совпадения и их папки", async () => {
      setActiveTree(nodes as any);
      render(ProjectTreeSection);

      await fireEvent.input(
        screen.getByRole("searchbox", { name: "Найти в дереве проекта" }),
        {
          target: { value: "api" },
        },
      );

      expect(screen.getByText("api.ts")).toBeInTheDocument();
      expect(screen.queryByText("main.ts")).toBeNull();
      expect(screen.queryByText("README.md")).toBeNull();
      expect(screen.getByText("Найдено: 1 файл")).toBeInTheDocument();
    });

    it("«выбрать все» при поиске выбирает только найденное", async () => {
      setActiveTree(nodes as any);
      render(ProjectTreeSection);

      await fireEvent.input(
        screen.getByRole("searchbox", { name: "Найти в дереве проекта" }),
        {
          target: { value: ".ts" },
        },
      );
      await fireEvent.click(
        screen.getByRole("checkbox", { name: "Выбрать все файлы дерева" }),
      );

      expect(get(selectedProjectFiles).sort()).toEqual([
        "src/api.ts",
        "src/main.ts",
      ]);
    });

    it("Escape очищает поиск", async () => {
      setActiveTree(nodes as any);
      render(ProjectTreeSection);
      const search = screen.getByRole("searchbox", {
        name: "Найти в дереве проекта",
      });

      await fireEvent.input(search, { target: { value: "zzz" } });
      expect(screen.getByText("Ничего не найдено")).toBeInTheDocument();
      await fireEvent.keyDown(search, { key: "Escape" });

      expect(screen.getByText("README.md")).toBeInTheDocument();
    });
  });
});
