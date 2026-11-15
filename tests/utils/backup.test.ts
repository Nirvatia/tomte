// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { strToU8, zipSync } from "fflate";

import type { Project } from "../../src/types";
import {
  buildBackup,
  parseBackup,
  BACKUP_FORMAT,
} from "../../src/utils/backup";

function sampleProject(): Project {
  const now = "2026-11-15T10:00:00.000Z";
  return {
    id: "p1",
    name: "Томте",
    files: [
      {
        id: "f1",
        name: "main",
        content: "<p>Привет, бэкап</p>",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "f2",
        name: "prompt-1",
        content: "<p>Второй файл</p>",
        createdAt: now,
        updatedAt: now,
      },
    ],
    attachments: [
      {
        id: "a1",
        name: "notes.txt",
        type: "text",
        size: 11,
        content: "текст вложения",
      },
      {
        id: "a2",
        name: "pic.png",
        type: "image",
        size: 4,
        ext: "png",
        width: 2,
        height: 2,
        dataUrl:
          "data:image/png;base64," +
          Buffer.from([1, 2, 3, 4]).toString("base64"),
      },
      {
        id: "a3",
        name: "archive.zip",
        type: "binary",
        size: 2048,
        ext: "zip",
      },
    ],
    githubConfig: {
      owner: "octo",
      repo: "demo",
      branch: "main",
      token: "ghp_secret_must_not_leak",
    },
    projectTreeSource: {
      rootName: "demo",
      fileCount: 1,
      nodes: [
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
      ],
    },
    totalSize: 100,
    createdAt: now,
    updatedAt: now,
  };
}

describe("бэкап проекта (10.1)", () => {
  it("круг «собрать → разобрать» сохраняет всё, кроме id", () => {
    const source = sampleProject();
    const imported = parseBackup(buildBackup(source));

    expect(imported.id).not.toBe(source.id);
    expect(imported.name).toBe("Томте");

    expect(imported.files.map((f) => [f.name, f.content])).toEqual(
      source.files.map((f) => [f.name, f.content]),
    );
    expect(imported.files.every((f) => f.id)).toBe(true);

    expect(imported.attachments).toHaveLength(3);
    const [text, image, binary] = imported.attachments;
    expect(text.content).toBe("текст вложения");
    expect(text.type).toBe("text");
    // Картинка вернулась теми же байтами.
    expect(image.dataUrl).toBe(source.attachments[1].dataUrl);
    expect(image.width).toBe(2);
    expect(binary.type).toBe("binary");
    expect(binary.content).toBeUndefined();
    expect(binary.dataUrl).toBeUndefined();

    // Токен в бэкап не уходит — репозиторий сохраняется без доступа.
    expect(imported.githubConfig).toEqual({
      owner: "octo",
      repo: "demo",
      branch: "main",
    });
    expect(JSON.stringify(buildBackup(source))).not.toContain("ghp_secret");

    expect(imported.projectTreeSource?.rootName).toBe("demo");
    expect(imported.projectTreeSource?.nodes).toEqual(
      source.projectTreeSource?.nodes,
    );
  });

  it("отказывает не-ZIP файл", () => {
    expect(() => parseBackup(strToU8("plain text, not zip"))).toThrow(/ZIP/i);
  });

  it("отказывает ZIP без файлов бэкапа", () => {
    const foreign = zipSync({ "readme.md": strToU8("hello") });
    expect(() => parseBackup(foreign)).toThrow(/бэкап/i);
  });

  it("отказывает чужую версию формата", () => {
    const archive = zipSync({
      "manifest.json": strToU8(
        JSON.stringify({ format: BACKUP_FORMAT + 1, app: "tomte" }),
      ),
      "project.json": strToU8(JSON.stringify({ name: "X" })),
    });
    expect(() => parseBackup(archive)).toThrow(/верси/i);
  });
});
