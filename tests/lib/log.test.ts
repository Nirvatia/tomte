import { describe, it, expect, vi, afterEach } from "vitest";

import {
  logError,
  logWarn,
  reportError,
  setErrorReporter,
} from "../../src/lib/log";
import { saveTags } from "../../src/utils/tags";

afterEach(() => {
  setErrorReporter(null);
  vi.restoreAllMocks();
});

describe("журнал ошибок", () => {
  it("logError и logWarn пишут в консоль с префиксом", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const cause = new Error("boom");

    logError("Failed to save", cause);
    logWarn("Could not read a.ts");

    expect(error).toHaveBeenCalledWith("[Tomte] Failed to save", cause);
    expect(warn).toHaveBeenCalledWith("[Tomte] Could not read a.ts");
  });

  it("reportError пишет в журнал и сообщает пользователю", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const reporter = vi.fn();
    setErrorReporter(reporter);

    reportError("Failed to save tags", new Error("quota"), "Теги не сохранены");

    expect(reporter).toHaveBeenCalledWith("Теги не сохранены");
  });

  it("без получателя reportError только пишет в журнал", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => reportError("x", new Error("y"), "z")).not.toThrow();
    expect(error).toHaveBeenCalled();
  });
});

describe("сохранение тегов", () => {
  it("переполненное хранилище — уведомление, а не тихая потеря", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(localStorage, "setItem").mockImplementation(() => {
      throw new DOMException("quota", "QuotaExceededError");
    });
    const reporter = vi.fn();
    setErrorReporter(reporter);

    saveTags([]);

    expect(reporter).toHaveBeenCalledWith(
      expect.stringContaining("Не удалось сохранить теги"),
    );
  });
});
