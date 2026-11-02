import { describe, it, expect, beforeEach, vi } from "vitest";

import {
  getLastProjectId,
  rememberLastProject,
} from "../../src/utils/lastProject";

describe("lastProject", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("запоминает и возвращает id", () => {
    expect(getLastProjectId()).toBeNull();
    rememberLastProject("p1");
    expect(getLastProjectId()).toBe("p1");
  });

  it("не падает, если localStorage недоступен", () => {
    vi.spyOn(localStorage, "setItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    vi.spyOn(localStorage, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });

    expect(() => rememberLastProject("p1")).not.toThrow();
    expect(getLastProjectId()).toBeNull();
  });
});
