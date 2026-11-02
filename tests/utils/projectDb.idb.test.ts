// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from "vitest";
import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { openDB } from "idb";

import type { AttachedFile, Project } from "../../src/types";
import type { TreeNode } from "../../src/utils/projectTree";

type ProjectDb = typeof import("../../src/utils/projectDb");

const DB_NAME = "tomte-projects-db";

/** Каждый тест получает чистую базу и свежий модуль (у модуля свой кэш соединения). */
async function freshDb(): Promise<ProjectDb> {
  vi.resetModules();
  return import("../../src/utils/projectDb");
}

function attachment(id: string, content = `content of ${id}`): AttachedFile {
  return {
    id,
    name: `${id}.txt`,
    size: content.length,
    type: "text",
    content,
    ext: "txt",
  };
}

function githubNode(path: string, token?: string): TreeNode {
  return {
    name: path.split("/").pop()!,
    path,
    type: "file",
    children: [],
    githubRef: {
      owner: "me",
      repo: "repo",
      branch: "main",
      ...(token ? { token } : {}),
    } as TreeNode["githubRef"],
  };
}

function makeProject(overrides: Partial<Project> = {}): Project {
  const now = "2024-01-01T00:00:00.000Z";
  return {
    id: "p1",
    name: "Test",
    files: [
      {
        id: "f1",
        name: "main",
        content: "<p>hi</p>",
        createdAt: now,
        updatedAt: now,
      },
    ],
    attachments: [],
    totalSize: 100,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

/** Читает сырые записи хранилищ, минуя projectDb. */
async function rawStores() {
  const db = await openDB(DB_NAME);
  const result = {
    projects: await db.getAll("projects"),
    attachments: await db.getAll("attachments"),
    trees: await db.getAll("trees"),
  };
  db.close();
  return result;
}

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
});

describe("projectDb: хранение по частям", () => {
  it("сохраняет и загружает проект целиком", async () => {
    const db = await freshDb();
    const project = makeProject({
      attachments: [attachment("a1"), attachment("a2")],
      projectTreeSource: {
        rootName: "repo",
        nodes: [githubNode("src/a.ts")],
        fileCount: 1,
      },
    });

    await db.saveProject(project);

    expect(await db.loadProject("p1")).toEqual(project);
  });

  it("раскладывает проект по трём хранилищам", async () => {
    const db = await freshDb();
    await db.saveProject(
      makeProject({
        attachments: [attachment("a1")],
        projectTreeSource: { rootName: "repo", nodes: [], fileCount: 0 },
      }),
    );

    const raw = await rawStores();
    expect(raw.projects).toHaveLength(1);
    expect(raw.projects[0]).not.toHaveProperty("attachments");
    expect(raw.projects[0]).not.toHaveProperty("projectTreeSource");
    expect(raw.projects[0].attachmentIds).toEqual(["a1"]);
    expect(raw.attachments).toEqual([
      expect.objectContaining({ id: "a1", projectId: "p1" }),
    ]);
    expect(raw.trees).toEqual([expect.objectContaining({ projectId: "p1" })]);
  });

  it("SAVE_META не трогает вложения и дерево", async () => {
    const db = await freshDb();
    const project = makeProject({
      attachments: [attachment("a1")],
      projectTreeSource: { rootName: "repo", nodes: [], fileCount: 0 },
    });
    await db.saveProject(project);

    // Подсовываем изменённые вложения: при SAVE_META они не должны записаться.
    await db.saveProject(
      {
        ...project,
        name: "Renamed",
        attachments: [attachment("a1", "CHANGED")],
        projectTreeSource: undefined,
      },
      db.SAVE_META,
    );

    const raw = await rawStores();
    expect(raw.projects[0].name).toBe("Renamed");
    expect(raw.attachments[0].content).toBe("content of a1");
    expect(raw.trees).toHaveLength(1);
  });

  it("put/delete вложений меняет только указанные записи", async () => {
    const db = await freshDb();
    const a1 = attachment("a1");
    const a2 = attachment("a2");
    const a3 = attachment("a3");
    await db.saveProject(makeProject({ attachments: [a1, a2] }));

    await db.saveProject(makeProject({ attachments: [a2, a3] }), {
      attachments: { put: [a3], delete: ["a1"] },
    });

    const loaded = await db.loadProject("p1");
    expect(loaded?.attachments.map((a) => a.id)).toEqual(["a2", "a3"]);
  });

  it("сохраняет порядок вложений", async () => {
    const db = await freshDb();
    const ids = ["z", "a", "m", "b"];
    await db.saveProject(
      makeProject({ attachments: ids.map((id) => attachment(id)) }),
    );

    const loaded = await db.loadProject("p1");
    expect(loaded?.attachments.map((a) => a.id)).toEqual(ids);
  });

  it('attachments: "all" удаляет лишние записи', async () => {
    const db = await freshDb();
    await db.saveProject(
      makeProject({ attachments: [attachment("a1"), attachment("a2")] }),
    );

    await db.saveProject(makeProject({ attachments: [] }), {
      attachments: "all",
    });

    expect((await rawStores()).attachments).toEqual([]);
  });

  it("tree: true удаляет дерево, если его больше нет", async () => {
    const db = await freshDb();
    const project = makeProject({
      projectTreeSource: { rootName: "repo", nodes: [], fileCount: 0 },
    });
    await db.saveProject(project);

    await db.saveProject(
      { ...project, projectTreeSource: undefined },
      { tree: true },
    );

    expect((await db.loadProject("p1"))?.projectTreeSource).toBeUndefined();
    expect((await rawStores()).trees).toEqual([]);
  });

  it("не сохраняет GitHub-токен в узлах дерева", async () => {
    const db = await freshDb();
    await db.saveProject(
      makeProject({
        githubConfig: {
          owner: "me",
          repo: "repo",
          branch: "main",
          token: "ghp_secret",
        },
        projectTreeSource: {
          rootName: "repo",
          nodes: [
            {
              name: "src",
              path: "src",
              type: "directory",
              children: [githubNode("src/a.ts", "ghp_secret")],
            },
          ],
          fileCount: 1,
        },
      }),
    );

    const raw = await rawStores();
    expect(JSON.stringify(raw.trees)).not.toContain("ghp_secret");
    // В настройках проекта токен остаётся.
    expect(raw.projects[0].githubConfig.token).toBe("ghp_secret");
  });

  it("бросает понятную ошибку, если запись не удалась", async () => {
    const db = await freshDb();
    const broken = makeProject({ name: (() => {}) as unknown as string });

    await expect(db.saveProject(broken)).rejects.toThrow(
      "Не удалось сохранить проект",
    );
  });

  it("loadProject возвращает null для несуществующего проекта", async () => {
    const db = await freshDb();
    expect(await db.loadProject("missing")).toBeNull();
  });

  it("deleteProject удаляет проект, его вложения и дерево", async () => {
    const db = await freshDb();
    await db.saveProject(
      makeProject({
        attachments: [attachment("a1")],
        projectTreeSource: { rootName: "repo", nodes: [], fileCount: 0 },
      }),
    );
    await db.saveProject(
      makeProject({ id: "p2", attachments: [attachment("b1")] }),
    );

    await db.deleteProject("p1");

    const raw = await rawStores();
    expect(raw.projects.map((p) => p.id)).toEqual(["p2"]);
    expect(raw.attachments.map((a) => a.id)).toEqual(["b1"]);
    expect(raw.trees).toEqual([]);
  });
});

describe("projectDb: список проектов", () => {
  it("loadProjectSummaries отдаёт счётчики без содержимого, свежие сверху", async () => {
    const db = await freshDb();
    await db.saveProject(
      makeProject({ id: "old", updatedAt: "2024-01-01T00:00:00Z" }),
    );
    await db.saveProject(
      makeProject({
        id: "new",
        updatedAt: "2024-02-01T00:00:00Z",
        attachments: [attachment("a1"), attachment("a2")],
        projectTreeSource: { rootName: "repo", nodes: [], fileCount: 0 },
      }),
    );

    const summaries = await db.loadProjectSummaries();

    expect(summaries.map((s) => s.id)).toEqual(["new", "old"]);
    expect(summaries[0]).toMatchObject({
      fileCount: 1,
      attachmentCount: 2,
      hasTree: true,
    });
    expect(summaries[1]).toMatchObject({ attachmentCount: 0, hasTree: false });
    expect(summaries[0]).not.toHaveProperty("attachments");
  });
});

describe("projectDb: initializeActiveProject", () => {
  it("создаёт и сохраняет новый проект, если база пуста", async () => {
    const db = await freshDb();
    const result = await db.initializeActiveProject();

    expect(result.name).toBe("Untitled Project");
    expect(result.files).toHaveLength(1);
    expect(await db.loadProject(result.id)).toEqual(result);
  });

  it("возвращает самый свежий проект целиком", async () => {
    const db = await freshDb();
    await db.saveProject(
      makeProject({ id: "old", updatedAt: "2024-01-01T00:00:00Z" }),
    );
    await db.saveProject(
      makeProject({
        id: "new",
        updatedAt: "2024-02-01T00:00:00Z",
        attachments: [attachment("a1")],
      }),
    );

    const result = await db.initializeActiveProject();
    expect(result.id).toBe("new");
    expect(result.attachments.map((a) => a.id)).toEqual(["a1"]);
    expect(await db.loadProjectSummaries()).toHaveLength(2);
  });

  it("создаёт проект в памяти, если база недоступна", async () => {
    const db = await freshDb();
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    globalThis.indexedDB = {
      open: () => {
        throw new Error("DB Error");
      },
    } as unknown as IDBFactory;

    const result = await db.initializeActiveProject();

    expect(result.name).toBe("Untitled Project");
    spy.mockRestore();
  });
});

describe("projectDb: миграция v1 → v2", () => {
  async function seedV1(projects: Project[]) {
    const db = await openDB(DB_NAME, 1, {
      upgrade(database) {
        database.createObjectStore("projects", { keyPath: "id" });
      },
    });
    for (const project of projects) {
      await db.put("projects", project);
    }
    db.close();
  }

  it("раскладывает старые проекты по хранилищам без потерь", async () => {
    const legacy = makeProject({
      attachments: [attachment("a2"), attachment("a1")],
      githubConfig: {
        owner: "me",
        repo: "repo",
        branch: "main",
        token: "ghp_secret",
      },
      projectTreeSource: {
        rootName: "repo",
        nodes: [githubNode("README.md", "ghp_secret")],
        fileCount: 1,
      },
    });
    await seedV1([legacy, makeProject({ id: "p2", name: "Second" })]);

    const db = await freshDb();
    const loaded = await db.loadProject("p1");

    expect(loaded?.attachments).toEqual(legacy.attachments);
    expect(loaded?.files).toEqual(legacy.files);
    expect(loaded?.githubConfig).toEqual(legacy.githubConfig);
    expect(loaded?.projectTreeSource?.nodes[0].githubRef).toEqual({
      owner: "me",
      repo: "repo",
      branch: "main",
    });
    expect((await db.loadProject("p2"))?.name).toBe("Second");

    const raw = await rawStores();
    expect(raw.projects.every((p) => !("attachments" in p))).toBe(true);
    expect(JSON.stringify(raw.trees)).not.toContain("ghp_secret");
  });
});

describe("utf8ByteLength", () => {
  it("считает байты как TextEncoder", async () => {
    const db = await freshDb();
    for (const text of [
      "",
      "abc",
      "привет",
      "日本語",
      "emoji 😀 and 𝄞",
      "mixed é ü ж",
    ]) {
      expect(db.utf8ByteLength(text)).toBe(
        new TextEncoder().encode(text).length,
      );
    }
  });
});
