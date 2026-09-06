// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
} from "@testing-library/svelte";
import "@testing-library/jest-dom/vitest";
import { tick } from "svelte";
import { get } from "svelte/store";
import ProjectTreeSection from "../../../src/components/project-tree/ProjectTreeSection.svelte";
import {
  activeProject,
  projectTreeNodes,
  projectTreeRootName,
  projectTreeString,
  selectedProjectFiles,
} from "../../../src/stores";
import {
  clearGithubConfig,
  restoreGithubTree,
  setProjectTreeSource,
} from "../../../src/utils/projectActions";
import {
  calculateStats,
  hasFileSystemAccess,
  readDirectoryRecursive,
  readDirectoryViaInput,
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

vi.mock("../../../src/utils/projectTree", () => ({
  calculateStats: vi.fn(),
  hasFileSystemAccess: vi.fn(),
  readDirectoryRecursive: vi.fn(),
  readDirectoryViaInput: vi.fn(),
}));

function makeEditorMock() {
  const run = vi.fn();
  const insertContent = vi.fn(() => ({ run }));
  const setCodeBlock = vi.fn(() => ({ insertContent }));
  const focus = vi.fn(() => ({ insertContent, setCodeBlock }));
  const chain = vi.fn(() => ({ focus }));

  return {
    chain,
    focus,
    setCodeBlock,
    insertContent,
    run,
  };
}

describe("ProjectTreeSection", () => {
  beforeEach(() => {
    activeProject.set(null);
    projectTreeNodes.set([]);
    projectTreeRootName.set("");
    projectTreeString.set("");
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

      expect(screen.getByText("Project")).toBeInTheDocument();
      expect(screen.getByText("Дерево не создано")).toBeInTheDocument();
      expect(
        screen.getByText(
          "Откройте папку или подключите GitHub-репозиторий",
        ),
      ).toBeInTheDocument();
    });

    it("показывает корень и файлы дерева", () => {
      projectTreeNodes.set([
        {
          name: "file.txt",
          path: "file.txt",
          type: "file",
          children: [],
        },
      ] as any);

      projectTreeRootName.set("my-project");

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
      projectTreeNodes.set([
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

      expect(get(selectedProjectFiles).sort()).toEqual([
        "b.md",
        "src/a.ts",
      ]);

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

      projectTreeString.set("project tree");

      render(ProjectTreeSection);

      const copyButton = screen.getByRole("button", {
        name: "Копировать дерево",
      });

      await fireEvent.click(copyButton);

      expect(writeText).toHaveBeenCalledWith("project tree");
    });
  });

  describe("Вставка дерева в редактор", () => {
    it("вставляет дерево в редактор как code block", async () => {
      const editor = makeEditorMock();

      projectTreeString.set("project tree");

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
      expect(editor.setCodeBlock).toHaveBeenCalled();
      expect(editor.insertContent).toHaveBeenCalledWith("project tree");
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
});