import { describe, it, expect, beforeEach } from "vitest";
import { get } from "svelte/store";

import {
  activeProject,
  activeFileId,
  selectedFileIds,
  promptFiles,
  activeFile,
  attachedFiles,
  totalFilesCount,
  selectedFilesCount,
} from "../../src/stores";
import type { Project } from "../../src/types";

function makeProject(overrides: Partial<Project> = {}): Project {
  const now = new Date().toISOString();
  return {
    id: "p1",
    name: "Test",
    files: [
      { id: "f1", name: "main.md", content: "hello", createdAt: now, updatedAt: now },
      { id: "f2", name: "second.md", content: "world", createdAt: now, updatedAt: now },
    ],
    attachments: [
      { id: "a1", name: "img.png", size: 100, type: "image", dataUrl: "data:..." },
      { id: "a2", name: "doc.txt", size: 50, type: "text", content: "text" },
    ],
    totalSize: 1000,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("stores/index derived stores", () => {
  beforeEach(() => {
    activeProject.set(null);
    activeFileId.set(null);
    selectedFileIds.set(new Set());
  });

  describe("promptFiles", () => {
    it("возвращает пустой массив, если нет активного проекта", () => {
      expect(get(promptFiles)).toEqual([]);
    });

    it("возвращает файлы активного проекта", () => {
      const project = makeProject();
      activeProject.set(project);
      expect(get(promptFiles)).toEqual(project.files);
    });
  });

  describe("activeFile", () => {
    it("возвращает null, если нет проекта или fileId", () => {
      expect(get(activeFile)).toBeNull();
      activeProject.set(makeProject());
      expect(get(activeFile)).toBeNull(); // project есть, но fileId нет
    });

    it("возвращает правильный файл по id", () => {
      const project = makeProject();
      activeProject.set(project);
      activeFileId.set("f2");
      expect(get(activeFile)).toEqual(project.files[1]);
    });

    it("возвращает null, если fileId не найден в проекте", () => {
      activeProject.set(makeProject());
      activeFileId.set("missing");
      expect(get(activeFile)).toBeNull();
    });
  });

  describe("attachedFiles", () => {
    it("возвращает пустой массив, если нет проекта", () => {
      expect(get(attachedFiles)).toEqual([]);
    });

    it("возвращает вложения активного проекта", () => {
      const project = makeProject();
      activeProject.set(project);
      expect(get(attachedFiles)).toEqual(project.attachments);
    });
  });

  describe("totalFilesCount", () => {
    it("возвращает 0, если нет вложений", () => {
      expect(get(totalFilesCount)).toBe(0);
    });

    it("возвращает корректное количество вложений", () => {
      activeProject.set(makeProject());
      expect(get(totalFilesCount)).toBe(2);
    });
  });

  describe("selectedFilesCount", () => {
    it("возвращает 0, если ничего не выбрано", () => {
      activeProject.set(makeProject());
      expect(get(selectedFilesCount)).toBe(0);
    });

    it("считает только те выбранные id, которые реально есть в проекте", () => {
      activeProject.set(makeProject());
      selectedFileIds.set(new Set(["a1", "missing-id"]));
      expect(get(selectedFilesCount)).toBe(1);
    });

    it("считает все выбранные вложения", () => {
      activeProject.set(makeProject());
      selectedFileIds.set(new Set(["a1", "a2"]));
      expect(get(selectedFilesCount)).toBe(2);
    });
  });
});