// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  readDirectoryRecursive,
  treeToText,
  buildTreeString,
  calculateStats,
  readDirectoryViaInput,
  hasFileSystemAccess,
  getSelectedTreeFilesAsAttachments,
  filterTree,
  type TreeNode,
} from "../../src/utils/projectTree";
import { fetchGithubFileContent } from "../../src/utils/github";

vi.mock("../../src/utils/github", () => ({
  fetchGithubFileContent: vi.fn(),
}));

function makeFile(relativePath: string, content = "content") {
  const parts = relativePath.split("/");
  const name = parts[parts.length - 1] ?? relativePath;

  const file = new File([content], name, { type: "text/plain" });

  Object.defineProperty(file, "webkitRelativePath", {
    value: relativePath,
    configurable: true,
  });

  return file;
}

function makeFileHandle(name: string) {
  return {
    kind: "file",
    name,
  };
}

function makeDirHandle(name: string, entries: any[] = []) {
  return {
    kind: "directory",
    name,
    values: async function* () {
      for (const entry of entries) {
        yield entry;
      }
    },
  };
}

describe("projectTree", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("treeToText", () => {
    it("строит текстовое дерево", () => {
      const nodes: TreeNode[] = [
        {
          name: "src",
          path: "src",
          type: "directory",
          children: [
            {
              name: "index.ts",
              path: "src/index.ts",
              type: "file",
              children: [],
            },
          ],
        },
        {
          name: "README.md",
          path: "README.md",
          type: "file",
          children: [],
        },
      ];

      expect(treeToText(nodes)).toBe("src\n└── index.ts\nREADME.md\n");
    });
  });

  describe("buildTreeString", () => {
    it("добавляет корень к текстовому дереву", () => {
      const nodes: TreeNode[] = [
        {
          name: "src",
          path: "src",
          type: "directory",
          children: [
            {
              name: "index.ts",
              path: "src/index.ts",
              type: "file",
              children: [],
            },
          ],
        },
        {
          name: "README.md",
          path: "README.md",
          type: "file",
          children: [],
        },
      ];

      expect(buildTreeString("project", nodes)).toBe(
        "project/\nsrc\n└── index.ts\nREADME.md\n",
      );
    });
  });

  describe("calculateStats", () => {
    it("считает файлы и директории", () => {
      const nodes: TreeNode[] = [
        {
          name: "src",
          path: "src",
          type: "directory",
          children: [
            {
              name: "index.ts",
              path: "src/index.ts",
              type: "file",
              children: [],
            },
          ],
        },
        {
          name: "README.md",
          path: "README.md",
          type: "file",
          children: [],
        },
      ];

      expect(calculateStats(nodes)).toEqual({
        totalFiles: 2,
        totalDirs: 1,
        rootName: "",
      });
    });
  });

  describe("readDirectoryRecursive", () => {
    it("читает директорию, игнорирует служебные папки и сортирует узлы", async () => {
      const root = makeDirHandle("root", [
        makeFileHandle("b.txt"),
        makeDirHandle(".git", [makeFileHandle("config")]),
        makeDirHandle("node_modules", [makeFileHandle("lib.js")]),
        makeDirHandle("src", [makeFileHandle("a.ts")]),
      ]);

      const nodes = await readDirectoryRecursive(root as any);

      expect(nodes.map((node) => node.name)).toEqual(["src", "b.txt"]);
      expect(nodes[0].type).toBe("directory");
      expect(nodes[0].children[0].name).toBe("a.ts");
      expect(nodes[0].children[0].path).toBe("src/a.ts");
      expect(nodes[1].type).toBe("file");
      expect(nodes[1].path).toBe("b.txt");
    });
  });

  describe("readDirectoryViaInput", () => {
    it("строит дерево из FileList и игнорирует служебные файлы", async () => {
      const files = [
        makeFile("project/src/index.js"),
        makeFile("project/README.md"),
        makeFile("project/node_modules/lib.js"),
        makeFile("project/.git/config"),
      ];

      const { nodes, rootName } = await readDirectoryViaInput(
        files as unknown as FileList,
      );

      expect(rootName).toBe("project");
      expect(nodes).toHaveLength(2);

      expect(nodes[0].name).toBe("src");
      expect(nodes[0].type).toBe("directory");
      expect(nodes[0].children[0].name).toBe("index.js");

      expect(nodes[1].name).toBe("README.md");
      expect(nodes[1].type).toBe("file");
    });

    it("возвращает пустое дерево, если файлов нет", async () => {
      const { nodes, rootName } = await readDirectoryViaInput(
        [] as unknown as FileList,
      );

      expect(nodes).toEqual([]);
      expect(rootName).toBe("root");
    });
  });

  describe("hasFileSystemAccess", () => {
    it("возвращает true, если доступен showDirectoryPicker", () => {
      (window as any).showDirectoryPicker = vi.fn();

      expect(hasFileSystemAccess()).toBe(true);

      delete (window as any).showDirectoryPicker;
    });

    it("возвращает false, если showDirectoryPicker недоступен", () => {
      delete (window as any).showDirectoryPicker;

      expect(hasFileSystemAccess()).toBe(false);
    });
  });

  describe("getSelectedTreeFilesAsAttachments", () => {
    it("возвращает только выбранные файлы", async () => {
      const selectedFile = new File(["hello"], "a.txt");
      const unselectedFile = new File(["nope"], "b.txt");

      const nodes: TreeNode[] = [
        {
          name: "a.txt",
          path: "a.txt",
          type: "file",
          children: [],
          fileRef: selectedFile,
        },
        {
          name: "b.txt",
          path: "b.txt",
          type: "file",
          children: [],
          fileRef: unselectedFile,
        },
      ];

      const result = await getSelectedTreeFilesAsAttachments(nodes, ["a.txt"]);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: "a.txt",
        name: "a.txt",
        type: "text",
        content: "hello",
      });
    });

    it("читает github-файлы через fetchGithubFileContent", async () => {
      vi.mocked(fetchGithubFileContent).mockResolvedValue({
        content: "github content",
        size: 14,
      } as any);

      const node: TreeNode = {
        name: "gh.txt",
        path: "gh.txt",
        type: "file",
        children: [],
        githubRef: {
          owner: "owner",
          repo: "repo",
          branch: "main",
        },
      };

      const result = await getSelectedTreeFilesAsAttachments(
        [node],
        ["gh.txt"],
      );

      expect(fetchGithubFileContent).toHaveBeenCalledWith(node);
      expect(result).toHaveLength(1);
      expect(result[0]?.content).toBe("github content");
      expect(result[0]?.size).toBe(14);
    });

    it("пропускает файлы без источника содержимого", async () => {
      const node: TreeNode = {
        name: "empty.txt",
        path: "empty.txt",
        type: "file",
        children: [],
      };

      const result = await getSelectedTreeFilesAsAttachments(
        [node],
        ["empty.txt"],
      );

      expect(result).toEqual([]);
    });

    it("пропускает файлы, которые не удалось прочитать", async () => {
      const badFileHandle = {
        getFile: vi.fn().mockRejectedValue(new Error("read error")),
      };

      const node: TreeNode = {
        name: "bad.txt",
        path: "bad.txt",
        type: "file",
        children: [],
        fileRef: badFileHandle as any,
      };

      const result = await getSelectedTreeFilesAsAttachments(
        [node],
        ["bad.txt"],
      );

      expect(result).toEqual([]);
    });
  });
});

describe("filterTree", () => {
  const tree: TreeNode[] = [
    {
      name: "src",
      path: "src",
      type: "directory",
      children: [
        {
          name: "Button.svelte",
          path: "src/Button.svelte",
          type: "file",
          children: [],
        },
        {
          name: "utils",
          path: "src/utils",
          type: "directory",
          children: [
            {
              name: "date.ts",
              path: "src/utils/date.ts",
              type: "file",
              children: [],
            },
            {
              name: "money.ts",
              path: "src/utils/money.ts",
              type: "file",
              children: [],
            },
          ],
        },
      ],
    },
    { name: "README.md", path: "README.md", type: "file", children: [] },
  ];

  it("пустой запрос возвращает дерево как есть", () => {
    expect(filterTree(tree, "  ").nodes).toBe(tree);
  });

  it("оставляет совпавшие файлы вместе с их папками, регистр не важен", () => {
    const { nodes, matches } = filterTree(tree, "DATE");
    expect(matches).toBe(1);
    expect(nodes).toHaveLength(1);
    expect(nodes[0].children[0].name).toBe("utils");
    expect(nodes[0].children[0].children.map((n) => n.name)).toEqual([
      "date.ts",
    ]);
  });

  it("совпадение по имени папки показывает её целиком", () => {
    const { nodes, matches } = filterTree(tree, "utils");
    expect(matches).toBe(2);
    expect(nodes[0].children[0].children).toHaveLength(2);
  });

  it("ищет и по пути", () => {
    expect(filterTree(tree, "src/button").matches).toBe(1);
  });

  it("ничего не нашлось", () => {
    expect(filterTree(tree, "zzz")).toEqual({ nodes: [], matches: 0 });
  });
});
