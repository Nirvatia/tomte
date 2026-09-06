import { describe, it, expect, vi, beforeEach } from "vitest";

// ИСПРАВЛЕНИЕ: создаём моки через vi.hoisted(), чтобы они были доступны внутри vi.mock
const { mockPut, mockGet, mockGetAll, mockDelete, mockDB } = vi.hoisted(() => {
  const mockPut = vi.fn();
  const mockGet = vi.fn();
  const mockGetAll = vi.fn();
  const mockDelete = vi.fn();

  const mockDB = {
    put: mockPut,
    get: mockGet,
    getAll: mockGetAll,
    delete: mockDelete,
  };

  return { mockPut, mockGet, mockGetAll, mockDelete, mockDB };
});

// Мокаем модуль idb ДО импорта projectDb
vi.mock("idb", () => ({
  openDB: vi.fn().mockResolvedValue(mockDB),
}));

// Импорты идут ПОСЛЕ vi.mock — так проект будет использовать замоканную версию idb
import {
  saveProject,
  loadProject,
  loadAllProjects,
  deleteProject,
  initializeActiveProject,
} from "../../src/utils/projectDb";
import type { Project } from "../../src/types";

function makeProject(id: string, name: string, updatedAt: string): Project {
  const now = new Date().toISOString();
  return {
    id,
    name,
    files: [
      {
        id: "f1",
        name: "main.md",
        content: "",
        createdAt: now,
        updatedAt: now,
      },
    ],
    attachments: [],
    totalSize: 100,
    createdAt: now,
    updatedAt,
  };
}

describe("projectDb with mocked IndexedDB", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPut.mockResolvedValue(undefined);
    mockGet.mockResolvedValue(undefined);
    mockGetAll.mockResolvedValue([]);
    mockDelete.mockResolvedValue(undefined);
  });

  describe("saveProject", () => {
    it("сохраняет проект в IndexedDB", async () => {
      const project = makeProject("p1", "Test", new Date().toISOString());
      await saveProject(project);
      expect(mockPut).toHaveBeenCalledWith("projects", project);
    });

    it("бросает ошибку, если IndexedDB недоступен (например, QuotaExceeded)", async () => {
      mockPut.mockRejectedValueOnce(new Error("QuotaExceededError"));
      const project = makeProject("p1", "Test", new Date().toISOString());
      await expect(saveProject(project)).rejects.toThrow(
        "Не удалось сохранить проект",
      );
    });
  });

  describe("loadProject", () => {
    it("возвращает проект по id", async () => {
      const project = makeProject("p1", "Test", new Date().toISOString());
      mockGet.mockResolvedValueOnce(project);
      const result = await loadProject("p1");
      expect(mockGet).toHaveBeenCalledWith("projects", "p1");
      expect(result).toEqual(project);
    });

    it("возвращает null, если проект не найден", async () => {
      mockGet.mockResolvedValueOnce(undefined);
      const result = await loadProject("missing");
      expect(result).toBeNull();
    });
  });

  describe("loadAllProjects", () => {
    it("возвращает все проекты", async () => {
      const p1 = makeProject("p1", "One", "2024-01-01T00:00:00Z");
      const p2 = makeProject("p2", "Two", "2024-01-02T00:00:00Z");
      mockGetAll.mockResolvedValueOnce([p1, p2]);
      const result = await loadAllProjects();
      expect(mockGetAll).toHaveBeenCalledWith("projects");
      expect(result).toEqual([p1, p2]);
    });
  });

  describe("deleteProject", () => {
    it("удаляет проект по id", async () => {
      await deleteProject("p1");
      expect(mockDelete).toHaveBeenCalledWith("projects", "p1");
    });
  });

  describe("initializeActiveProject", () => {
    it("создаёт и сохраняет новый проект, если база пуста", async () => {
      mockGetAll.mockResolvedValueOnce([]);
      const result = await initializeActiveProject();

      expect(result.name).toBe("Untitled Project");
      expect(result.files).toHaveLength(1);
      expect(mockPut).toHaveBeenCalledWith(
        "projects",
        expect.objectContaining({
          name: "Untitled Project",
        }),
      );
    });

    it("возвращает самый свежий проект (по updatedAt), если они есть", async () => {
      const oldProject = makeProject("p1", "Old", "2024-01-01T00:00:00Z");
      const newProject = makeProject("p2", "New", "2024-01-02T00:00:00Z");
      mockGetAll.mockResolvedValueOnce([oldProject, newProject]);

      const result = await initializeActiveProject();
      expect(result.id).toBe("p2");
      expect(mockPut).not.toHaveBeenCalled(); // Не должен создавать новый
    });

    it("создаёт fallback-проект в памяти при ошибке чтения базы", async () => {
      mockGetAll.mockRejectedValueOnce(new Error("DB Error"));
      const result = await initializeActiveProject();

      expect(result.name).toBe("Untitled Project");
      expect(result.files).toHaveLength(1);
      expect(mockPut).not.toHaveBeenCalled();
    });
  });
});
