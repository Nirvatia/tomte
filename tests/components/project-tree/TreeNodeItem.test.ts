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
import TreeNodeItem from "../../../src/components/project-tree/TreeNodeItem.svelte";
import {
  selectedProjectFiles,
  previewFileFromTree,
} from "../../../src/stores";
import { requestAlert } from "../../../src/stores/confirm";
import { fetchGithubFileContent } from "../../../src/utils/github";

vi.mock("../../../src/stores/confirm", () => ({
  requestAlert: vi.fn(),
  requestConfirm: vi.fn(),
}));

vi.mock("../../../src/utils/github", () => ({
  fetchGithubFileContent: vi.fn(),
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

const fileNode = {
  name: "file.txt",
  path: "src/file.txt",
  type: "file",
  children: [],
};

const directoryNode = {
  name: "src",
  path: "src",
  type: "directory",
  children: [
    {
      name: "child.txt",
      path: "src/child.txt",
      type: "file",
      children: [],
    },
    {
      name: "other.txt",
      path: "src/other.txt",
      type: "file",
      children: [],
    },
  ],
};

describe("TreeNodeItem", () => {
  beforeEach(() => {
    selectedProjectFiles.set([]);
    previewFileFromTree.set(null);
    vi.clearAllMocks();
  });

  describe("Рендеринг", () => {
    it("рендерит файл с чекбоксом и именем", () => {
      render(TreeNodeItem, {
        props: {
          node: fileNode,
        },
      });

      expect(screen.getByText("file.txt")).toBeInTheDocument();
      expect(
        screen.getByRole("checkbox", { name: "Выбрать file.txt" }),
      ).toBeInTheDocument();
    });

    it("рендерит директорию и её детей по умолчанию открытой", () => {
      render(TreeNodeItem, {
        props: {
          node: directoryNode,
        },
      });

      expect(screen.getByText("src")).toBeInTheDocument();
      expect(screen.getByText("child.txt")).toBeInTheDocument();
      expect(screen.getByText("other.txt")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Свернуть папку" }),
      ).toBeInTheDocument();
    });
  });

  describe("Выбор файлов", () => {
    it("выбирает и снимает выбор файла", async () => {
      render(TreeNodeItem, {
        props: {
          node: fileNode,
        },
      });

      const checkbox = screen.getByRole("checkbox", {
        name: "Выбрать file.txt",
      });

      await fireEvent.click(checkbox);

      expect(get(selectedProjectFiles)).toContain("src/file.txt");

      await fireEvent.click(checkbox);

      expect(get(selectedProjectFiles)).not.toContain("src/file.txt");
    });

    it("выбирает все файлы внутри директории", async () => {
      render(TreeNodeItem, {
        props: {
          node: directoryNode,
        },
      });

      const checkbox = screen.getByRole("checkbox", {
        name: "Выбрать src",
      });

      await fireEvent.click(checkbox);

      expect(get(selectedProjectFiles).sort()).toEqual([
        "src/child.txt",
        "src/other.txt",
      ]);

      await fireEvent.click(checkbox);

      expect(get(selectedProjectFiles)).toEqual([]);
    });

    it("показывает indeterminate, если выбрана только часть файлов директории", async () => {
      selectedProjectFiles.set(["src/child.txt"]);

      render(TreeNodeItem, {
        props: {
          node: directoryNode,
        },
      });

      const checkbox = screen.getByRole("checkbox", {
        name: "Выбрать src",
      }) as HTMLInputElement;

      await waitFor(() => {
        expect(checkbox.indeterminate).toBe(true);
      });
    });
  });

  describe("Сворачивание директории", () => {
    it("сворачивает и разворачивает директорию", async () => {
      render(TreeNodeItem, {
        props: {
          node: directoryNode,
        },
      });

      const collapseButton = screen.getByRole("button", {
        name: "Свернуть папку",
      });

      await fireEvent.click(collapseButton);

      expect(screen.queryByText("child.txt")).toBeNull();
      expect(screen.queryByText("other.txt")).toBeNull();

      const expandButton = screen.getByRole("button", {
        name: "Развернуть папку",
      });

      await fireEvent.click(expandButton);

      expect(screen.getByText("child.txt")).toBeInTheDocument();
      expect(screen.getByText("other.txt")).toBeInTheDocument();
    });
  });

  describe("Предпросмотр файла", () => {
    it("устанавливает пустой предпросмотр, если нет источника содержимого", async () => {
      render(TreeNodeItem, {
        props: {
          node: fileNode,
        },
      });

      const previewButton = screen.getByRole("button", {
        name: "Просмотреть содержимое file.txt",
      });

      await fireEvent.click(previewButton);

      await waitFor(() => {
        expect(get(previewFileFromTree)).toEqual({
          id: "src/file.txt",
          name: "file.txt",
          size: 0,
          type: "text",
        });
      });
    });

    it("читает содержимое обычного File", async () => {
      const file = new File(["file content"], "file.txt");

      render(TreeNodeItem, {
        props: {
          node: {
            ...fileNode,
            fileRef: file,
          },
        },
      });

      const previewButton = screen.getByRole("button", {
        name: "Просмотреть содержимое file.txt",
      });

      await fireEvent.click(previewButton);

      await waitFor(() => {
        const preview = get(previewFileFromTree);

        expect(preview?.content).toBe("file content");
        expect(preview?.size).toBe(file.size);
      });
    });

    it("читает github-файл через fetchGithubFileContent", async () => {
      vi.mocked(fetchGithubFileContent).mockResolvedValue({
        content: "github content",
        size: 14,
      } as any);

      const node = {
        ...fileNode,
        githubRef: {
          owner: "owner",
          repo: "repo",
          branch: "main",
        },
      };

      render(TreeNodeItem, {
        props: {
          node,
        },
      });

      const previewButton = screen.getByRole("button", {
        name: "Просмотреть содержимое file.txt",
      });

      await fireEvent.click(previewButton);

      await waitFor(() => {
        expect(fetchGithubFileContent).toHaveBeenCalledWith(node);
        expect(get(previewFileFromTree)?.content).toBe("github content");
        expect(get(previewFileFromTree)?.size).toBe(14);
      });
    });

    it("показывает ошибку, если файл не удалось прочитать", async () => {
      const badFileHandle = {
        getFile: vi.fn().mockRejectedValue(new Error("read error")),
      };

      render(TreeNodeItem, {
        props: {
          node: {
            ...fileNode,
            fileRef: badFileHandle,
          },
        },
      });

      const previewButton = screen.getByRole("button", {
        name: "Просмотреть содержимое file.txt",
      });

      await fireEvent.click(previewButton);

      await waitFor(() => {
        expect(requestAlert).toHaveBeenCalled();
      });
    });
  });

  describe("Вставка ссылки в редактор", () => {
    it("вставляет ссылку на файл в редактор", async () => {
      const editor = makeEditorMock();

      render(TreeNodeItem, {
        props: {
          node: fileNode,
          editor: editor as any,
        },
      });

      const insertLinkButton = screen.getByRole("button", {
        name: "Вставить ссылку на файл file.txt",
      });

      await fireEvent.click(insertLinkButton);

      expect(editor.chain).toHaveBeenCalled();
      expect(editor.focus).toHaveBeenCalled();
      expect(editor.insertContent).toHaveBeenCalledWith("[src/file.txt] ");
      expect(editor.run).toHaveBeenCalled();
    });
  });
});