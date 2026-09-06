// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/svelte";
import "@testing-library/jest-dom/vitest";
import { get } from "svelte/store";

import ProjectManagerModal from "../../../src/components/projects/ProjectManagerModal.svelte";
import { activeProject, isProjectManagerOpen } from "../../../src/stores";
import { requestConfirm, requestAlert } from "../../../src/stores/confirm";
import {
  loadAllProjects,
  calculateProjectSize,
} from "../../../src/utils/projectDb";
import {
  createNewProject,
  deleteProjectById,
  duplicateProjectById,
  renameProjectById,
  switchProject,
} from "../../../src/utils/projectActions";

vi.mock("../../../src/stores/confirm", () => ({
  requestConfirm: vi.fn(),
  requestAlert: vi.fn(),
}));

vi.mock("../../../src/utils", () => ({
  formatFileSize: vi.fn(() => "1 КБ"),
  getErrorMessage: vi.fn((error: any, fallback: string) => {
    if (error instanceof Error && error.message) {
      return error.message;
    }

    return fallback;
  }),
  pluralize: vi.fn(() => ""),
}));

vi.mock("../../../src/utils/projectDb", () => ({
  loadAllProjects: vi.fn(),
  calculateProjectSize: vi.fn(),
}));

vi.mock("../../../src/utils/projectActions", () => ({
  createNewProject: vi.fn(),
  deleteProjectById: vi.fn(),
  duplicateProjectById: vi.fn(),
  renameProjectById: vi.fn(),
  switchProject: vi.fn(),
}));

function makeProject(overrides: Record<string, any> = {}) {
  return {
    id: overrides.id ?? `project-${Math.random().toString(36).slice(2)}`,
    name: overrides.name ?? "Test Project",
    files: overrides.files ?? [],
    attachments: overrides.attachments ?? [],
    projectTreeSource: overrides.projectTreeSource,
    githubConfig: overrides.githubConfig,
    createdAt: overrides.createdAt ?? new Date().toISOString(),
    updatedAt: overrides.updatedAt ?? new Date().toISOString(),
    totalSize: overrides.totalSize ?? 0,
  } as any;
}

async function renderOpen(projects: any[] = []) {
  vi.mocked(loadAllProjects).mockResolvedValue(projects);

  isProjectManagerOpen.set(true);

  const result = render(ProjectManagerModal);

  await waitFor(() => {
    expect(loadAllProjects).toHaveBeenCalled();
  });

  return result;
}

describe("ProjectManagerModal", () => {
  beforeEach(() => {
    activeProject.set(null);
    isProjectManagerOpen.set(false);

    vi.clearAllMocks();

    vi.mocked(calculateProjectSize).mockReturnValue(1024);
    vi.mocked(loadAllProjects).mockResolvedValue([]);

    vi.mocked(requestConfirm).mockResolvedValue(false);
    vi.mocked(requestAlert).mockResolvedValue(undefined as any);

    vi.mocked(createNewProject).mockResolvedValue(undefined as any);
    vi.mocked(deleteProjectById).mockResolvedValue(true);
    vi.mocked(duplicateProjectById).mockResolvedValue(undefined as any);
    vi.mocked(renameProjectById).mockResolvedValue(undefined as any);
    vi.mocked(switchProject).mockResolvedValue(undefined as any);
  });

  describe("Видимость и загрузка", () => {
    it("не рендерится, когда менеджер закрыт", () => {
      render(ProjectManagerModal);

      expect(
        screen.queryByRole("dialog", { name: "Менеджер проектов" }),
      ).toBeNull();
    });

    it("рендерится и загружает проекты при открытии", async () => {
      const projects = [makeProject({ name: "Alpha" })];

      await renderOpen(projects);

      expect(
        await screen.findByRole("dialog", { name: "Менеджер проектов" }),
      ).toBeInTheDocument();

      expect(await screen.findByText("Alpha")).toBeInTheDocument();
    });

    it("показывает состояние загрузки", async () => {
      let resolveLoad: ((projects: any[]) => void) | undefined;

      vi.mocked(loadAllProjects).mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveLoad = resolve;
          }),
      );

      isProjectManagerOpen.set(true);

      render(ProjectManagerModal);

      expect(
        await screen.findByText("Загрузка проектов..."),
      ).toBeInTheDocument();

      resolveLoad?.([]);

      expect(await screen.findByText("Нет проектов")).toBeInTheDocument();
    });

    it("показывает ошибку, если не удалось загрузить проекты", async () => {
      vi.mocked(loadAllProjects).mockRejectedValue(new Error("db fail"));

      isProjectManagerOpen.set(true);

      render(ProjectManagerModal);

      expect(
        await screen.findByText("Не удалось загрузить список проектов."),
      ).toBeInTheDocument();
    });

    it("сортирует проекты по убыванию updatedAt", async () => {
      const older = makeProject({
        id: "old",
        name: "Old Project",
        updatedAt: "2024-01-01T00:00:00.000Z",
      });

      const newer = makeProject({
        id: "new",
        name: "New Project",
        updatedAt: "2024-02-01T00:00:00.000Z",
      });

      await renderOpen([older, newer]);

      await waitFor(() => {
        const rows = screen.getAllByRole("button", {
          name: /Переключиться на проект|Активный проект/,
        });

        expect(rows).toHaveLength(2);
      });

      const rows = screen.getAllByRole("button", {
        name: /Переключиться на проект|Активный проект/,
      });

      expect(rows[0]).toHaveAttribute(
        "aria-label",
        expect.stringContaining("New Project"),
      );
    });
  });

  describe("Поиск", () => {
    it("фильтрует проекты по имени", async () => {
      await renderOpen([
        makeProject({ name: "Alpha" }),
        makeProject({ name: "Beta" }),
      ]);

      await screen.findByText("Alpha");
      await screen.findByText("Beta");

      const searchInput = screen.getByLabelText("Поиск по проектам");

      await fireEvent.input(searchInput, {
        target: { value: "alph" },
      });

      expect(await screen.findByText("Alpha")).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.queryByText("Beta")).toBeNull();
      });
    });

    it("показывает состояние, когда ничего не найдено", async () => {
      await renderOpen([makeProject({ name: "Alpha" })]);

      await screen.findByText("Alpha");

      const searchInput = screen.getByLabelText("Поиск по проектам");

      await fireEvent.input(searchInput, {
        target: { value: "nonexistent" },
      });

      expect(await screen.findByText("Ничего не найдено")).toBeInTheDocument();

      expect(
        await screen.findByText("Попробуйте изменить запрос"),
      ).toBeInTheDocument();
    });
  });

  describe("Пустые состояния", () => {
    it("показывает пустое состояние, если проектов нет", async () => {
      await renderOpen([]);

      expect(await screen.findByText("Нет проектов")).toBeInTheDocument();
    });
  });

  describe("Активный проект", () => {
    it("отмечает активный проект", async () => {
      const project = makeProject({
        id: "active",
        name: "Active Project",
      });

      activeProject.set(project);

      await renderOpen([project]);

      const row = await screen.findByRole("button", {
        name: "Активный проект Active Project",
      });

      expect(row).toBeInTheDocument();
      expect(screen.getByText("Активный")).toBeInTheDocument();
    });

    it("показывает метаданные проекта, включая дерево", async () => {
      const project = makeProject({
        name: "Meta Project",
        files: [{ id: "file-1", name: "main.md" }],
        attachments: [{ id: "attachment-1", name: "file.txt" }],
        projectTreeSource: {
          rootName: "root",
          nodes: [],
          fileCount: 0,
        },
      });

      await renderOpen([project]);

      await screen.findByText("Meta Project");

      expect(screen.getByText("дерево")).toBeInTheDocument();
    });
  });

  describe("Переключение проекта", () => {
    it("переключает проект и не закрывает модалку", async () => {
      const project = makeProject({
        id: "p1",
        name: "Project One",
      });

      await renderOpen([project]);

      const row = await screen.findByRole("button", {
        name: "Переключиться на проект Project One",
      });

      await fireEvent.click(row);

      await waitFor(() => {
        expect(switchProject).toHaveBeenCalledWith("p1");
      });

      expect(get(isProjectManagerOpen)).toBe(true);
    });

    it("переключает проект по Enter", async () => {
      const project = makeProject({
        id: "p1",
        name: "Project One",
      });

      await renderOpen([project]);

      const row = await screen.findByRole("button", {
        name: "Переключиться на проект Project One",
      });

      await fireEvent.keyDown(row, { key: "Enter" });

      await waitFor(() => {
        expect(switchProject).toHaveBeenCalledWith("p1");
      });
    });

    it("при клике на активный проект закрывает модалку без переключения", async () => {
      const project = makeProject({
        id: "active",
        name: "Active",
      });

      activeProject.set(project);

      await renderOpen([project]);

      const row = await screen.findByRole("button", {
        name: "Активный проект Active",
      });

      await fireEvent.click(row);

      await waitFor(() => {
        expect(get(isProjectManagerOpen)).toBe(false);
      });

      expect(switchProject).not.toHaveBeenCalled();
    });

    it("показывает ошибку, если переключение не удалось", async () => {
      vi.mocked(switchProject).mockRejectedValue(new Error("switch fail"));

      const project = makeProject({
        id: "p1",
        name: "Project One",
      });

      await renderOpen([project]);

      const row = await screen.findByRole("button", {
        name: "Переключиться на проект Project One",
      });

      await fireEvent.click(row);

      await screen.findByText("switch fail");

      expect(get(isProjectManagerOpen)).toBe(true);
    });
  });

  describe("Создание проекта", () => {
    it("открывает форму создания с предложенным именем", async () => {
      await renderOpen([
        makeProject({ name: "First" }),
        makeProject({ name: "Second" }),
      ]);

      await screen.findByText("First");
      await screen.findByText("Second");

      await fireEvent.click(
        screen.getByRole("button", { name: "Новый проект" }),
      );

      const input = await screen.findByLabelText("Имя нового проекта");

      expect(input).toHaveValue("Проект 3");
    });

    it("создаёт проект по кнопке", async () => {
      await renderOpen([makeProject({ name: "Alpha" })]);

      await screen.findByText("Alpha");

      await fireEvent.click(
        screen.getByRole("button", { name: "Новый проект" }),
      );

      const input = await screen.findByLabelText("Имя нового проекта");

      await fireEvent.input(input, {
        target: { value: "Custom Project" },
      });

      await fireEvent.click(screen.getByRole("button", { name: "Создать" }));

      await waitFor(() => {
        expect(createNewProject).toHaveBeenCalledWith("Custom Project");
      });

      await waitFor(() => {
        expect(loadAllProjects).toHaveBeenCalledTimes(2);
      });

      await waitFor(() => {
        expect(screen.queryByLabelText("Имя нового проекта")).toBeNull();
      });
    });

    it("создаёт проект по Enter", async () => {
      await renderOpen([makeProject({ name: "Alpha" })]);

      await screen.findByText("Alpha");

      await fireEvent.click(
        screen.getByRole("button", { name: "Новый проект" }),
      );

      const input = await screen.findByLabelText("Имя нового проекта");

      await fireEvent.input(input, {
        target: { value: "Enter Project" },
      });

      await fireEvent.keyDown(input, { key: "Enter" });

      await waitFor(() => {
        expect(createNewProject).toHaveBeenCalledWith("Enter Project");
      });
    });

    it("отменяет создание проекта", async () => {
      await renderOpen([]);

      await screen.findByText("Нет проектов");

      await fireEvent.click(
        screen.getByRole("button", { name: "Новый проект" }),
      );

      await screen.findByLabelText("Имя нового проекта");

      await fireEvent.click(screen.getByRole("button", { name: "Отмена" }));

      await waitFor(() => {
        expect(screen.queryByLabelText("Имя нового проекта")).toBeNull();
      });

      expect(createNewProject).not.toHaveBeenCalled();
    });

    it("не создаёт проект с пустым именем", async () => {
      await renderOpen([]);

      await screen.findByText("Нет проектов");

      await fireEvent.click(
        screen.getByRole("button", { name: "Новый проект" }),
      );

      const input = await screen.findByLabelText("Имя нового проекта");

      await fireEvent.input(input, {
        target: { value: "   " },
      });

      const createButton = screen.getByRole("button", {
        name: "Создать",
      });

      expect(createButton).toBeDisabled();

      await fireEvent.keyDown(input, { key: "Enter" });

      await waitFor(() => {
        expect(screen.queryByLabelText("Имя нового проекта")).toBeNull();
      });

      expect(createNewProject).not.toHaveBeenCalled();
    });

    it("показывает ошибку, если создание проекта не удалось", async () => {
      vi.mocked(createNewProject).mockRejectedValue(new Error("create fail"));

      await renderOpen([]);

      await screen.findByText("Нет проектов");

      await fireEvent.click(
        screen.getByRole("button", { name: "Новый проект" }),
      );

      const input = await screen.findByLabelText("Имя нового проекта");

      await fireEvent.input(input, {
        target: { value: "Fail Project" },
      });

      await fireEvent.click(screen.getByRole("button", { name: "Создать" }));

      await screen.findByText("create fail");

      expect(screen.getByLabelText("Имя нового проекта")).toBeInTheDocument();
    });
  });

  describe("Переименование проекта", () => {
    it("переименовывает проект по Enter", async () => {
      const project = makeProject({
        id: "p1",
        name: "Alpha",
      });

      await renderOpen([project]);

      await fireEvent.click(
        await screen.findByRole("button", {
          name: "Переименовать проект Alpha",
        }),
      );

      const input = await screen.findByDisplayValue("Alpha");

      await fireEvent.input(input, {
        target: { value: "Beta" },
      });

      await fireEvent.keyDown(input, { key: "Enter" });

      await waitFor(() => {
        expect(renameProjectById).toHaveBeenCalledWith("p1", "Beta");
      });

      await waitFor(() => {
        expect(screen.queryByDisplayValue("Beta")).toBeNull();
      });
    });

    it("переименовывает проект по blur", async () => {
      const project = makeProject({
        id: "p1",
        name: "Alpha",
      });

      await renderOpen([project]);

      await fireEvent.click(
        await screen.findByRole("button", {
          name: "Переименовать проект Alpha",
        }),
      );

      const input = await screen.findByDisplayValue("Alpha");

      await fireEvent.input(input, {
        target: { value: "Blurred Name" },
      });

      await fireEvent.blur(input);

      await waitFor(() => {
        expect(renameProjectById).toHaveBeenCalledWith("p1", "Blurred Name");
      });
    });

    it("отменяет переименование по Escape", async () => {
      const project = makeProject({
        id: "p1",
        name: "Alpha",
      });

      await renderOpen([project]);

      await fireEvent.click(
        await screen.findByRole("button", {
          name: "Переименовать проект Alpha",
        }),
      );

      const input = await screen.findByDisplayValue("Alpha");

      await fireEvent.keyDown(input, { key: "Escape" });

      await waitFor(() => {
        expect(screen.queryByDisplayValue("Alpha")).toBeNull();
      });

      expect(renameProjectById).not.toHaveBeenCalled();
      expect(get(isProjectManagerOpen)).toBe(true);
    });

    it("отменяет переименование, если имя пустое", async () => {
      const project = makeProject({
        id: "p1",
        name: "Alpha",
      });

      await renderOpen([project]);

      await fireEvent.click(
        await screen.findByRole("button", {
          name: "Переименовать проект Alpha",
        }),
      );

      const input = await screen.findByDisplayValue("Alpha");

      await fireEvent.input(input, {
        target: { value: "   " },
      });

      await fireEvent.keyDown(input, { key: "Enter" });

      await waitFor(() => {
        expect(screen.queryByDisplayValue("Alpha")).toBeNull();
      });

      expect(renameProjectById).not.toHaveBeenCalled();
    });

    it("показывает ошибку, если переименование не удалось", async () => {
      vi.mocked(renameProjectById).mockRejectedValue(new Error("rename fail"));

      const project = makeProject({
        id: "p1",
        name: "Alpha",
      });

      await renderOpen([project]);

      await fireEvent.click(
        await screen.findByRole("button", {
          name: "Переименовать проект Alpha",
        }),
      );

      const input = await screen.findByDisplayValue("Alpha");

      await fireEvent.input(input, {
        target: { value: "Beta" },
      });

      await fireEvent.keyDown(input, { key: "Enter" });

      await screen.findByText("rename fail");

      expect(screen.getByDisplayValue("Beta")).toBeInTheDocument();
    });
  });

  describe("Удаление проекта", () => {
    it("удаляет проект после подтверждения", async () => {
      vi.mocked(requestConfirm).mockResolvedValue(true);
      vi.mocked(deleteProjectById).mockResolvedValue(true);

      await renderOpen([
        makeProject({ id: "p1", name: "Alpha" }),
        makeProject({ id: "p2", name: "Beta" }),
      ]);

      await screen.findByText("Alpha");
      await screen.findByText("Beta");

      await fireEvent.click(
        screen.getByRole("button", {
          name: "Удалить проект Alpha",
        }),
      );

      await waitFor(() => {
        expect(requestConfirm).toHaveBeenCalledWith(
          expect.objectContaining({
            title: "Удалить проект?",
            danger: true,
            message: expect.stringContaining("Alpha"),
          }),
        );
      });

      await waitFor(() => {
        expect(deleteProjectById).toHaveBeenCalledWith("p1");
      });

      await waitFor(() => {
        expect(loadAllProjects).toHaveBeenCalledTimes(2);
      });
    });

    it("не удаляет проект, если подтверждение отменено", async () => {
      vi.mocked(requestConfirm).mockResolvedValue(false);

      await renderOpen([
        makeProject({ id: "p1", name: "Alpha" }),
        makeProject({ id: "p2", name: "Beta" }),
      ]);

      await screen.findByText("Alpha");

      await fireEvent.click(
        screen.getByRole("button", {
          name: "Удалить проект Alpha",
        }),
      );

      await waitFor(() => {
        expect(requestConfirm).toHaveBeenCalled();
      });

      expect(deleteProjectById).not.toHaveBeenCalled();
    });

    it("показывает alert, если deleteProjectById вернул false", async () => {
      vi.mocked(requestConfirm).mockResolvedValue(true);
      vi.mocked(deleteProjectById).mockResolvedValue(false);

      await renderOpen([
        makeProject({ id: "p1", name: "Alpha" }),
        makeProject({ id: "p2", name: "Beta" }),
      ]);

      await screen.findByText("Alpha");

      await fireEvent.click(
        screen.getByRole("button", {
          name: "Удалить проект Alpha",
        }),
      );

      await waitFor(() => {
        expect(requestAlert).toHaveBeenCalledWith(
          expect.objectContaining({
            title: "Нельзя удалить",
          }),
        );
      });
    });

    it("показывает ошибку, если удаление не удалось", async () => {
      vi.mocked(requestConfirm).mockResolvedValue(true);
      vi.mocked(deleteProjectById).mockRejectedValue(new Error("delete fail"));

      await renderOpen([
        makeProject({ id: "p1", name: "Alpha" }),
        makeProject({ id: "p2", name: "Beta" }),
      ]);

      await screen.findByText("Alpha");

      await fireEvent.click(
        screen.getByRole("button", {
          name: "Удалить проект Alpha",
        }),
      );

      await screen.findByText("delete fail");
    });

    it("запрещает удаление последнего проекта", async () => {
      await renderOpen([makeProject({ id: "p1", name: "Alpha" })]);

      const deleteButton = await screen.findByRole("button", {
        name: "Удалить проект Alpha",
      });

      expect(deleteButton).toBeDisabled();
      expect(deleteButton).toHaveAttribute(
        "title",
        "Нельзя удалить последний проект",
      );
    });
  });

  describe("Дублирование проекта", () => {
    it("дублирует проект", async () => {
      const project = makeProject({
        id: "p1",
        name: "Alpha",
      });

      await renderOpen([project]);

      await fireEvent.click(
        await screen.findByRole("button", {
          name: "Дублировать проект Alpha",
        }),
      );

      await waitFor(() => {
        expect(duplicateProjectById).toHaveBeenCalledWith("p1");
      });

      await waitFor(() => {
        expect(loadAllProjects).toHaveBeenCalledTimes(2);
      });
    });

    it("показывает ошибку, если дублирование не удалось", async () => {
      vi.mocked(duplicateProjectById).mockRejectedValue(
        new Error("duplicate fail"),
      );

      const project = makeProject({
        id: "p1",
        name: "Alpha",
      });

      await renderOpen([project]);

      await fireEvent.click(
        await screen.findByRole("button", {
          name: "Дублировать проект Alpha",
        }),
      );

      await screen.findByText("duplicate fail");
    });
  });

  describe("Закрытие модалки", () => {
    it("закрывается кнопкой закрытия", async () => {
      await renderOpen([]);

      await screen.findByText("Нет проектов");

      await fireEvent.click(
        screen.getByRole("button", {
          name: "Закрыть менеджер проектов",
        }),
      );

      await waitFor(() => {
        expect(get(isProjectManagerOpen)).toBe(false);
      });
    });

    it("закрывается по клику на фон", async () => {
      await renderOpen([]);

      const dialog = await screen.findByRole("dialog", {
        name: "Менеджер проектов",
      });

      await fireEvent.click(dialog);

      await waitFor(() => {
        expect(get(isProjectManagerOpen)).toBe(false);
      });
    });

    it("закрывается по Escape", async () => {
      await renderOpen([]);

      await screen.findByText("Нет проектов");

      await fireEvent.keyDown(window, { key: "Escape" });

      await waitFor(() => {
        expect(get(isProjectManagerOpen)).toBe(false);
      });
    });

    it("Escape отменяет создание проекта, но не закрывает модалку", async () => {
      await renderOpen([]);

      await screen.findByText("Нет проектов");

      await fireEvent.click(
        screen.getByRole("button", { name: "Новый проект" }),
      );

      await screen.findByLabelText("Имя нового проекта");

      await fireEvent.keyDown(window, { key: "Escape" });

      await waitFor(() => {
        expect(screen.queryByLabelText("Имя нового проекта")).toBeNull();
      });

      expect(get(isProjectManagerOpen)).toBe(true);
    });
  });
});
