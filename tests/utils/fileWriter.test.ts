// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";

import {
  planFolderWrite,
  readFolderFile,
  writeFolderFile,
  type PlanInput,
} from "../../src/utils/fileWriter";

/** In-memory stub File System Access: папка с файлами и подпапками. */
class StubFileHandle {
  content = "";
  async getFile(): Promise<File> {
    return new File([this.content], "stub");
  }
  createWritable = async () => ({
    write: async (data: string) => {
      this.content = String(data);
    },
    close: async () => {},
    abort: async () => {},
  });
}

class StubDirectory {
  dirs = new Map<string, StubDirectory>();
  files = new Map<string, StubFileHandle>();
  constructor(public name: string) {}

  async getDirectoryHandle(
    name: string,
    options?: { create?: boolean },
  ): Promise<StubDirectory> {
    if (!this.dirs.has(name)) {
      if (!options?.create) {
        throw new DOMException("not found", "NotFoundError");
      }
      this.dirs.set(name, new StubDirectory(name));
    }
    return this.dirs.get(name)!;
  }

  async getFileHandle(
    name: string,
    options?: { create?: boolean },
  ): Promise<StubFileHandle> {
    if (!this.files.has(name)) {
      if (!options?.create) {
        throw new DOMException("not found", "NotFoundError");
      }
      this.files.set(name, new StubFileHandle());
    }
    return this.files.get(name)!;
  }

  seed(path: string, content: string) {
    const parts = path.split("/");
    const nested: StubDirectory[] = [];
    for (const part of parts.slice(0, -1)) {
      const child = nested.at(-1) ?? this;
      nested.push(child.dirs.get(part) ?? new StubDirectory(part));
    }
    for (let i = 0; i < nested.length; i++) {
      const parent = i === 0 ? this : nested[i - 1];
      parent.dirs.set(parts[i], nested[i]);
    }
    const dir = nested.at(-1) ?? this;
    const handle = new StubFileHandle();
    handle.content = content;
    dir.files.set(parts.at(-1)!, handle);
  }
}

const asHandle = (stub: StubDirectory): FileSystemDirectoryHandle =>
  stub as unknown as FileSystemDirectoryHandle;

describe("fileWriter (10.5)", () => {
  it("план: новый, изменённый с размером правок, без изменений", async () => {
    const stub = new StubDirectory("demo");
    stub.seed("src/b.ts", "export const b = 1;\nold line");
    const files: PlanInput[] = [
      { name: "src/a.ts", code: "export const a = 1;" },
      { name: "src/b.ts", code: "export const b = 1;\nnew line" },
      { name: "src/c.ts", code: "same" },
    ];
    stub.seed("src/c.ts", "same");

    const plan = await planFolderWrite(asHandle(stub), files);
    expect(plan.map((p) => [p.path, p.status])).toEqual([
      ["src/a.ts", "new"],
      ["src/b.ts", "changed"],
      ["src/c.ts", "same"],
    ]);
    expect(plan[1].added).toBe(1);
    expect(plan[1].removed).toBe(1);
    expect(plan[0].status).toBe("new");
  });

  it("нормализует обратные слэши и ведущий слэш", async () => {
    const stub = new StubDirectory("demo");
    stub.seed("src/a.ts", "x");
    expect(await readFolderFile(asHandle(stub), "\\src\\a.ts")).toBe("x");
    expect(await readFolderFile(asHandle(stub), "/src/a.ts")).toBe("x");
    expect(await readFolderFile(asHandle(stub), "missing.ts")).toBeNull();
  });

  it("writeFolderFile создаёт вложенные каталоги и пишет содержимое", async () => {
    const stub = new StubDirectory("demo");
    await writeFolderFile(asHandle(stub), "src/lib/deep/note.md", "# hello");
    expect(await readFolderFile(asHandle(stub), "src/lib/deep/note.md")).toBe(
      "# hello",
    );
    // Перезапись того же файла.
    await writeFolderFile(asHandle(stub), "src/lib/deep/note.md", "# v2");
    expect(await readFolderFile(asHandle(stub), "src/lib/deep/note.md")).toBe(
      "# v2",
    );
  });

  it("пустой путь отклоняется", async () => {
    const stub = new StubDirectory("demo");
    await expect(writeFolderFile(asHandle(stub), "", "x")).rejects.toThrow();
  });
});
