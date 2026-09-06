// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
} from "@testing-library/svelte";
import "@testing-library/jest-dom/vitest";

import GithubConnectModal from "../../../src/components/project-tree/GithubConnectModal.svelte";
import { activeProject, selectedProjectFiles } from "../../../src/stores";
import { fetchGithubTree, parseGithubUrl } from "../../../src/utils/github";
import { calculateStats } from "../../../src/utils/projectTree";
import {
  setGithubConfig,
  setProjectTreeSource,
} from "../../../src/utils/projectActions";
import type { TreeNode } from "../../../src/utils/projectTree";

vi.mock("../../../src/utils/github", () => ({
  fetchGithubTree: vi.fn(),
  parseGithubUrl: vi.fn(),
}));

vi.mock("../../../src/utils/projectTree", () => ({
  calculateStats: vi.fn(),
}));

vi.mock("../../../src/utils/projectActions", () => ({
  setGithubConfig: vi.fn(),
  setProjectTreeSource: vi.fn(),
}));

const mockNodes: TreeNode[] = [
  {
    name: "src",
    path: "src",
    type: "directory",
    children: [
      { name: "index.ts", path: "src/index.ts", type: "file", children: [] },
    ],
  },
];

describe("GithubConnectModal", () => {
  beforeEach(() => {
    activeProject.set(null);
    selectedProjectFiles.set([]);

    vi.clearAllMocks();

    vi.mocked(parseGithubUrl).mockReturnValue({
      owner: "test-owner",
      repo: "test-repo",
    });
    vi.mocked(fetchGithubTree).mockResolvedValue(mockNodes);
    vi.mocked(calculateStats).mockReturnValue({
      totalFiles: 1,
      totalDirs: 1,
      rootName: "",
    });
    vi.mocked(setProjectTreeSource).mockResolvedValue(true);
    vi.mocked(setGithubConfig).mockResolvedValue(undefined);
  });

  describe("Видимость", () => {
    it("не рендерится, когда isOpen=false", () => {
      render(GithubConnectModal, { props: { isOpen: false } });

      expect(
        screen.queryByRole("dialog", { name: "Подключить GitHub" }),
      ).toBeNull();
    });

    it("рендерится, когда isOpen=true", async () => {
      render(GithubConnectModal, { props: { isOpen: true } });

      expect(
        await screen.findByRole("dialog", { name: "Подключить GitHub" }),
      ).toBeInTheDocument();
    });

    it("показывает заголовок", async () => {
      render(GithubConnectModal, { props: { isOpen: true } });

      expect(
        await screen.findByText("Подключить GitHub"),
      ).toBeInTheDocument();
    });
  });

  describe("Форма", () => {
    it("показывает поле URL репозитория", async () => {
      render(GithubConnectModal, { props: { isOpen: true } });

      await screen.findByRole("dialog");

      expect(screen.getByLabelText("URL репозитория")).toBeInTheDocument();
    });

    it("показывает поле ветки", async () => {
      render(GithubConnectModal, { props: { isOpen: true } });

      await screen.findByRole("dialog");

      expect(screen.getByLabelText("Ветка (branch)")).toBeInTheDocument();
    });

    it("показывает поле токена", async () => {
      render(GithubConnectModal, { props: { isOpen: true } });

      await screen.findByRole("dialog");

      expect(
        screen.getByLabelText(/Personal Access Token/),
      ).toBeInTheDocument();
    });

    it("ветка по умолчанию равна 'main'", async () => {
      render(GithubConnectModal, { props: { isOpen: true } });

      await screen.findByRole("dialog");

      expect(screen.getByLabelText("Ветка (branch)")).toHaveValue("main");
    });

    it("кнопка 'Подключить' заблокирована при пустом URL", async () => {
      render(GithubConnectModal, { props: { isOpen: true } });

      await screen.findByRole("dialog");

      const connectButton = screen.getByRole("button", { name: "Подключить" });
      expect(connectButton).toBeDisabled();
    });

    it("кнопка 'Подключить' активна при заполненном URL", async () => {
      render(GithubConnectModal, { props: { isOpen: true } });

      await screen.findByRole("dialog");

      await fireEvent.input(screen.getByLabelText("URL репозитория"), {
        target: { value: "https://github.com/owner/repo" },
      });

      const connectButton = screen.getByRole("button", { name: "Подключить" });
      expect(connectButton).toBeEnabled();
    });
  });

  describe("Префилл из конфигурации проекта", () => {
    it("заполняет поля из сохранённой конфигурации", async () => {
      activeProject.set({
        id: "p1",
        name: "Test",
        files: [],
        attachments: [],
        totalSize: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        githubConfig: {
          owner: "my-owner",
          repo: "my-repo",
          branch: "develop",
          token: "ghp_secret",
        },
      } as any);

      render(GithubConnectModal, { props: { isOpen: true } });

      await screen.findByRole("dialog");

      expect(screen.getByLabelText("URL репозитория")).toHaveValue(
        "https://github.com/my-owner/my-repo",
      );
      expect(screen.getByLabelText("Ветка (branch)")).toHaveValue("develop");
      expect(screen.getByLabelText(/Personal Access Token/)).toHaveValue(
        "ghp_secret",
      );
    });
  });

  describe("Валидация", () => {
    it("показывает ошибку при неверном URL", async () => {
      vi.mocked(parseGithubUrl).mockReturnValue(null);

      render(GithubConnectModal, { props: { isOpen: true } });

      await screen.findByRole("dialog");

      await fireEvent.input(screen.getByLabelText("URL репозитория"), {
        target: { value: "not-a-url" },
      });

      await fireEvent.click(screen.getByRole("button", { name: "Подключить" }));

      expect(
        await screen.findByText(/Неверный URL репозитория/),
      ).toBeInTheDocument();
    });

    it("не вызывает fetchGithubTree при неверном URL", async () => {
      vi.mocked(parseGithubUrl).mockReturnValue(null);

      render(GithubConnectModal, { props: { isOpen: true } });

      await screen.findByRole("dialog");

      await fireEvent.input(screen.getByLabelText("URL репозитория"), {
        target: { value: "bad" },
      });

      await fireEvent.click(screen.getByRole("button", { name: "Подключить" }));

      expect(fetchGithubTree).not.toHaveBeenCalled();
    });
  });

  describe("Подключение репозитория", () => {
    it("вызывает полный цикл подключения при успешном подключении", async () => {
      const onClose = vi.fn();

      render(GithubConnectModal, {
        props: { isOpen: true, onClose },
      });

      await screen.findByRole("dialog");

      await fireEvent.input(screen.getByLabelText("URL репозитория"), {
        target: { value: "https://github.com/test-owner/test-repo" },
      });

      await fireEvent.click(screen.getByRole("button", { name: "Подключить" }));

      await waitFor(() => {
        expect(parseGithubUrl).toHaveBeenCalledWith(
          "https://github.com/test-owner/test-repo",
        );
      });

      await waitFor(() => {
        expect(fetchGithubTree).toHaveBeenCalledWith({
          owner: "test-owner",
          repo: "test-repo",
          branch: "main",
          token: undefined,
        });
      });

      await waitFor(() => {
        expect(setProjectTreeSource).toHaveBeenCalledWith({
          rootName: "test-repo",
          nodes: mockNodes,
          fileCount: 1,
        });
      });

      await waitFor(() => {
        expect(setGithubConfig).toHaveBeenCalledWith({
          owner: "test-owner",
          repo: "test-repo",
          branch: "main",
          token: undefined,
        });
      });

      await waitFor(() => {
        expect(onClose).toHaveBeenCalled();
      });
    });

    it("показывает ошибку, если дерево не сохранено", async () => {
      vi.mocked(setProjectTreeSource).mockResolvedValue(false);

      render(GithubConnectModal, { props: { isOpen: true } });

      await screen.findByRole("dialog");

      await fireEvent.input(screen.getByLabelText("URL репозитория"), {
        target: { value: "https://github.com/owner/repo" },
      });

      await fireEvent.click(screen.getByRole("button", { name: "Подключить" }));

      expect(
        await screen.findByText(/Дерево не сохранено/),
      ).toBeInTheDocument();
    });

    it("показывает ошибку при сбое загрузки", async () => {
      vi.mocked(fetchGithubTree).mockRejectedValue(
        new Error("Network error"),
      );

      render(GithubConnectModal, { props: { isOpen: true } });

      await screen.findByRole("dialog");

      await fireEvent.input(screen.getByLabelText("URL репозитория"), {
        target: { value: "https://github.com/owner/repo" },
      });

      await fireEvent.click(screen.getByRole("button", { name: "Подключить" }));

      expect(
        await screen.findByText("Network error"),
      ).toBeInTheDocument();
    });

    it("показывает состояние загрузки", async () => {
      let resolveTree: (nodes: TreeNode[]) => void;
      vi.mocked(fetchGithubTree).mockReturnValue(
        new Promise((resolve) => {
          resolveTree = resolve;
        }),
      );

      render(GithubConnectModal, { props: { isOpen: true } });

      await screen.findByRole("dialog");

      await fireEvent.input(screen.getByLabelText("URL репозитория"), {
        target: { value: "https://github.com/owner/repo" },
      });

      await fireEvent.click(screen.getByRole("button", { name: "Подключить" }));

      expect(await screen.findByText("Загрузка...")).toBeInTheDocument();

      resolveTree!(mockNodes);
    });
  });

  describe("Закрытие", () => {
    it("закрывается по кнопке закрытия", async () => {
      const onClose = vi.fn();

      render(GithubConnectModal, {
        props: { isOpen: true, onClose },
      });

      await screen.findByRole("dialog");

      await fireEvent.click(screen.getByRole("button", { name: "Закрыть" }));

      expect(onClose).toHaveBeenCalled();
    });

    it("закрывается по клику на фон", async () => {
      const onClose = vi.fn();

      render(GithubConnectModal, {
        props: { isOpen: true, onClose },
      });

      const dialog = await screen.findByRole("dialog", {
        name: "Подключить GitHub",
      });

      await fireEvent.click(dialog);

      expect(onClose).toHaveBeenCalled();
    });

    it("закрывается по Escape", async () => {
      const onClose = vi.fn();

      render(GithubConnectModal, {
        props: { isOpen: true, onClose },
      });

      await screen.findByRole("dialog");

      await fireEvent.keyDown(window, { key: "Escape" });

      expect(onClose).toHaveBeenCalled();
    });
  });
});