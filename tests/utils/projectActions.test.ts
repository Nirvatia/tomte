import { describe, it, expect, vi, beforeEach } from "vitest";
import { get } from "svelte/store";

import {
  activeProject,
  openFileIds,
  activeFileId,
  previewFileId,
  selectedFileIds,
  selectedProjectFiles,
  projectTreeNodes,
  projectTreeRootName,
  projectTreeString,
  previewFileFromTree,
  editorHtml,
  fileName,
  pendingSaveController,
} from "../../src/stores";

import {
  createPromptFile,
  renamePromptFile,
  deletePromptFile,
  activatePromptFile,
  previewPromptFile,
  pinPromptFile,
  closePromptFileTab,
  addAttachmentsToProject,
  removeAttachmentFromProject,
  removeSelectedAttachmentsFromProject,
} from "../../src/utils/projectActions";

import {
  saveProject,
  checkProjectSize,
  calculateProjectSize,
} from "../../src/utils/projectDb";

import { requestConfirm } from "../../src/stores/confirm";

// Оставляем импорт для использования ВНУТРИ самих тестов (в it-блоках)
import { PROJECT_SIZE_LIMIT } from "../../src/types";
import type { AttachedFile, Project, PromptFile } from "../../src/types";

// ИСПРАВЛЕНИЕ: Создаем переменную через vi.hoisted, чтобы она была доступна внутри vi.mock
const { MOCK_LIMIT } = vi.hoisted(() => ({ MOCK_LIMIT: 50 * 1024 * 1024 }));

vi.mock("../../src/utils/projectDb", async (importOriginal) => {
  const actual = await importOriginal<any>();

  return {
    ...actual,
    saveProject: vi.fn().mockResolvedValue(undefined),
    loadProject: vi.fn(),
    deleteProject: vi.fn(),
    loadAllProjects: vi.fn().mockResolvedValue([]),

    checkProjectSize: vi.fn().mockReturnValue({
      ok: true,
      size: 100,
      limit: MOCK_LIMIT, // Используем переменную из vi.hoisted
    }),

    calculateProjectSize: vi.fn().mockReturnValue(100),
  };
});

vi.mock("../../src/stores/confirm", () => ({
  requestConfirm: vi.fn().mockResolvedValue(true),
  requestAlert: vi.fn().mockResolvedValue(true),
}));

function promptFile(id: string, name: string, content = ""): PromptFile {
  const now = new Date().toISOString();

  return {
    id,
    name,
    content,
    createdAt: now,
    updatedAt: now,
  };
}

function makeProject(overrides: Partial<Project> = {}): Project {
  const now = new Date().toISOString();

  return {
    id: "project-1",
    name: "Test Project",
    files: [promptFile("file-1", "main.md", "hello")],
    attachments: [],
    totalSize: 100,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function attachment(overrides: Partial<AttachedFile> = {}): AttachedFile {
  return {
    id: "att-1",
    name: "notes.txt",
    size: 10,
    type: "text",
    content: "hello",
    ...overrides,
  };
}

function resetStores(): void {
  activeProject.set(null);
  openFileIds.set([]);
  activeFileId.set(null);
  previewFileId.set(null);
  selectedFileIds.set(new Set());
  selectedProjectFiles.set([]);
  projectTreeNodes.set([]);
  projectTreeRootName.set("");
  projectTreeString.set("");
  previewFileFromTree.set(null);
  editorHtml.set("");
  fileName.set("prompt");
  pendingSaveController.set(null);
}

describe("projectActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStores();

    vi.mocked(requestConfirm).mockResolvedValue(true);
    vi.mocked(saveProject).mockResolvedValue(undefined);

    vi.mocked(checkProjectSize).mockReturnValue({
      ok: true,
      size: 100,
      limit: PROJECT_SIZE_LIMIT,
    });

    vi.mocked(calculateProjectSize).mockReturnValue(100);
  });

  describe("createPromptFile", () => {
    it("создаёт файл, открывает его и делает активным", async () => {
      activeProject.set(makeProject());

      const newFileId = await createPromptFile("new-file.md");

      expect(newFileId).toBeTruthy();

      const project = get(activeProject);
      expect(project).toBeTruthy();
      expect(project!.files).toHaveLength(2);

      const createdFile = project!.files[project!.files.length - 1];
      expect(createdFile.id).toBe(newFileId);
      expect(createdFile.name).toBe("new-file.md");
      expect(createdFile.content).toBe("");

      expect(get(openFileIds)).toContain(newFileId);
      expect(get(activeFileId)).toBe(newFileId);
      expect(get(previewFileId)).toBeNull();

      expect(saveProject).toHaveBeenCalledTimes(1);
    });

    it("генерирует уникальное имя, если файл с таким именем уже есть", async () => {
      activeProject.set(
        makeProject({
          files: [promptFile("file-1", "prompt-1.md")],
        }),
      );

      await createPromptFile("prompt-1.md");

      const project = get(activeProject);
      const createdFile = project!.files[project!.files.length - 1];

      expect(createdFile.name).toBe("prompt-1 (2).md");
    });

    it("возвращает null, если нет активного проекта", async () => {
      const result = await createPromptFile("file.md");
      expect(result).toBeNull();
      expect(saveProject).not.toHaveBeenCalled();
    });
  });

  describe("renamePromptFile", () => {
    it("переименовывает файл и сохраняет проект", async () => {
      activeProject.set(makeProject());
      openFileIds.set(["file-1"]);
      activeFileId.set("file-1");

      const result = await renamePromptFile("file-1", "renamed.md");

      expect(result).toBe(true);

      const project = get(activeProject);
      expect(project!.files[0].name).toBe("renamed.md");
      expect(saveProject).toHaveBeenCalledTimes(1);
    });

    it("не сохраняет проект, если имя не изменилось", async () => {
      activeProject.set(makeProject());
      openFileIds.set(["file-1"]);
      activeFileId.set("file-1");

      const result = await renamePromptFile("file-1", "main.md");

      expect(result).toBe(true);
      expect(saveProject).not.toHaveBeenCalled();
    });

    it("возвращает false, если проект не найден", async () => {
      const result = await renamePromptFile("file-1", "new.md");
      expect(result).toBe(false);
      expect(saveProject).not.toHaveBeenCalled();
    });
  });

  describe("deletePromptFile", () => {
    it("при удалении последнего файла создаёт новый main.md", async () => {
      activeProject.set(
        makeProject({
          files: [promptFile("file-1", "only.md")],
        }),
      );

      openFileIds.set(["file-1"]);
      activeFileId.set("file-1");

      const result = await deletePromptFile("file-1");

      expect(result).toBe(true);

      const project = get(activeProject);
      expect(project!.files).toHaveLength(1);

      const newFile = project!.files[0];
      expect(newFile.id).not.toBe("file-1");
      expect(newFile.name).toBe("main.md");

      expect(get(openFileIds)).toEqual([newFile.id]);
      expect(get(activeFileId)).toBe(newFile.id);
      expect(get(previewFileId)).toBeNull();

      expect(saveProject).toHaveBeenCalledTimes(1);
    });

    it("удаляет один из нескольких файлов и выбирает соседнюю вкладку", async () => {
      activeProject.set(
        makeProject({
          files: [
            promptFile("f1", "one.md"),
            promptFile("f2", "two.md"),
            promptFile("f3", "three.md"),
          ],
        }),
      );

      openFileIds.set(["f1", "f2", "f3"]);
      activeFileId.set("f2");

      await deletePromptFile("f2");

      const project = get(activeProject);
      expect(project!.files.map((f) => f.id)).toEqual(["f1", "f3"]);

      expect(get(openFileIds)).toEqual(["f1", "f3"]);
      expect(get(activeFileId)).toBe("f3");
    });

    it("возвращает false, если файла нет в проекте", async () => {
      activeProject.set(makeProject());

      const result = await deletePromptFile("missing-id");

      expect(result).toBe(false);
      expect(saveProject).not.toHaveBeenCalled();
    });
  });

  describe("activatePromptFile", () => {
    it("делает файл активным", async () => {
      activeProject.set(
        makeProject({
          files: [promptFile("f1", "one.md"), promptFile("f2", "two.md")],
        }),
      );

      openFileIds.set(["f1", "f2"]);
      activeFileId.set("f1");

      await activatePromptFile("f2");

      expect(get(activeFileId)).toBe("f2");
    });

    it("ничего не делает, если файла нет в проекте", async () => {
      activeProject.set(makeProject());
      activeFileId.set("file-1");

      await activatePromptFile("missing");

      expect(get(activeFileId)).toBe("file-1");
    });
  });

  describe("previewPromptFile", () => {
    it("открывает файл в режиме предпросмотра, если он не закреплён", async () => {
      activeProject.set(
        makeProject({
          files: [promptFile("f1", "one.md"), promptFile("f2", "two.md")],
        }),
      );

      openFileIds.set(["f1"]);
      activeFileId.set("f1");

      await previewPromptFile("f2");

      expect(get(previewFileId)).toBe("f2");
      expect(get(activeFileId)).toBe("f2");
    });

    it("не устанавливает preview, если файл уже открыт", async () => {
      activeProject.set(
        makeProject({
          files: [promptFile("f1", "one.md"), promptFile("f2", "two.md")],
        }),
      );

      openFileIds.set(["f1", "f2"]);
      activeFileId.set("f1");

      await previewPromptFile("f2");

      expect(get(previewFileId)).toBeNull();
      expect(get(activeFileId)).toBe("f2");
    });
  });

  describe("pinPromptFile", () => {
    it("закрепляет файл во вкладках и снимает статус предпросмотра", async () => {
      activeProject.set(
        makeProject({
          files: [promptFile("f1", "one.md"), promptFile("f2", "two.md")],
        }),
      );

      openFileIds.set(["f1"]);
      previewFileId.set("f2");
      activeFileId.set("f2");

      await pinPromptFile("f2");

      expect(get(openFileIds)).toEqual(["f1", "f2"]);
      expect(get(previewFileId)).toBeNull();
      expect(get(activeFileId)).toBe("f2");
    });
  });

  describe("closePromptFileTab", () => {
    it("закрывает вкладку и активирует соседний файл", async () => {
      activeProject.set(
        makeProject({
          files: [
            promptFile("f1", "one.md"),
            promptFile("f2", "two.md"),
            promptFile("f3", "three.md"),
          ],
        }),
      );

      openFileIds.set(["f1", "f2", "f3"]);
      activeFileId.set("f2");

      await closePromptFileTab("f2");

      expect(get(openFileIds)).toEqual(["f1", "f3"]);
      expect(get(activeFileId)).toBe("f3");
    });

    it("корректно закрывает вкладку, которая находится в предпросмотре", async () => {
      activeProject.set(
        makeProject({
          files: [promptFile("f1", "one.md"), promptFile("f2", "two.md")],
        }),
      );

      openFileIds.set(["f1"]);
      previewFileId.set("f2");
      activeFileId.set("f2");

      await closePromptFileTab("f2");

      expect(get(previewFileId)).toBeNull();
      expect(get(activeFileId)).toBe("f1");
    });
  });

  describe("addAttachmentsToProject", () => {
    it("добавляет вложения в проект", async () => {
      activeProject.set(makeProject());

      const file = attachment();

      await addAttachmentsToProject([file]);

      const project = get(activeProject);
      expect(project!.attachments).toHaveLength(1);
      expect(project!.attachments[0]).toMatchObject({
        id: "att-1",
        name: "notes.txt",
        type: "text",
      });

      expect(saveProject).toHaveBeenCalledTimes(1);
    });

    it("при превышении лимита предлагает добавить файлы только как метаданные", async () => {
      activeProject.set(makeProject());

      vi.mocked(checkProjectSize)
        .mockReturnValueOnce({
          ok: false,
          size: PROJECT_SIZE_LIMIT + 1,
          limit: PROJECT_SIZE_LIMIT,
        })
        .mockReturnValueOnce({
          ok: true,
          size: 1200,
          limit: PROJECT_SIZE_LIMIT,
        });

      vi.mocked(requestConfirm).mockResolvedValueOnce(true);

      const file = attachment({
        content: "very large content",
      });

      await addAttachmentsToProject([file]);

      const project = get(activeProject);

      expect(requestConfirm).toHaveBeenCalledTimes(1);
      expect(project!.attachments).toHaveLength(1);

      const savedAttachment = project!.attachments[0];
      expect(savedAttachment.content).toBeUndefined();
      expect(savedAttachment.dataUrl).toBeUndefined();
      expect(project!.totalSize).toBe(1200);

      expect(saveProject).toHaveBeenCalledTimes(1);
    });

    it("отменяет добавление вложений, если пользователь отказался", async () => {
      activeProject.set(makeProject());

      vi.mocked(checkProjectSize).mockReturnValueOnce({
        ok: false,
        size: PROJECT_SIZE_LIMIT + 1,
        limit: PROJECT_SIZE_LIMIT,
      });

      vi.mocked(requestConfirm).mockResolvedValueOnce(false);

      const file = attachment();

      await expect(addAttachmentsToProject([file])).rejects.toThrow(
        /Файлы не добавлены/,
      );

      const project = get(activeProject);
      expect(project!.attachments).toHaveLength(0);
      expect(saveProject).not.toHaveBeenCalled();
    });
  });

  describe("removeAttachmentFromProject", () => {
    it("удаляет вложение и убирает его из выбранных", async () => {
      activeProject.set(
        makeProject({
          attachments: [
            attachment({ id: "att-1", name: "one.txt" }),
            attachment({ id: "att-2", name: "two.txt" }),
          ],
        }),
      );

      selectedFileIds.set(new Set(["att-1", "att-2"]));

      await removeAttachmentFromProject("att-1");

      const project = get(activeProject);
      expect(project!.attachments).toHaveLength(1);
      expect(project!.attachments[0].id).toBe("att-2");

      const selected = get(selectedFileIds);
      expect(selected.has("att-1")).toBe(false);
      expect(selected.has("att-2")).toBe(true);

      expect(saveProject).toHaveBeenCalledTimes(1);
    });
  });

  describe("removeSelectedAttachmentsFromProject", () => {
    it("удаляет только выбранные вложения", async () => {
      activeProject.set(
        makeProject({
          attachments: [
            attachment({ id: "att-1", name: "one.txt" }),
            attachment({ id: "att-2", name: "two.txt" }),
          ],
        }),
      );

      selectedFileIds.set(new Set(["att-1"]));

      const deletedCount = await removeSelectedAttachmentsFromProject();

      expect(deletedCount).toBe(1);

      const project = get(activeProject);
      expect(project!.attachments).toHaveLength(1);
      expect(project!.attachments[0].id).toBe("att-2");

      const selected = get(selectedFileIds);
      expect(selected.size).toBe(0);

      expect(saveProject).toHaveBeenCalledTimes(1);
    });

    it("возвращает 0, если выбранных файлов нет", async () => {
      activeProject.set(
        makeProject({
          attachments: [attachment()],
        }),
      );

      selectedFileIds.set(new Set());

      const deletedCount = await removeSelectedAttachmentsFromProject();

      expect(deletedCount).toBe(0);
      expect(saveProject).not.toHaveBeenCalled();
    });
  });
});
