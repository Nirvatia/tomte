import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  formatFileSize,
  sanitizeFileName,
  generateId,
  pluralize,
  getErrorMessage,
  createFlushableAsync,
} from "../../src/utils/index";

describe("formatFileSize", () => {
  it("форматирует байты", () => {
    expect(formatFileSize(0)).toBe("0 B");
    expect(formatFileSize(500)).toBe("500 B");
    expect(formatFileSize(1023)).toBe("1023 B");
  });

  it("форматирует килобайты", () => {
    expect(formatFileSize(1024)).toBe("1.0 KB");
    expect(formatFileSize(2048)).toBe("2.0 KB");
    expect(formatFileSize(1536)).toBe("1.5 KB");
  });

  it("форматирует мегабайты", () => {
    expect(formatFileSize(1024 * 1024)).toBe("1.0 MB");
    expect(formatFileSize(3 * 1024 * 1024)).toBe("3.0 MB");
    expect(formatFileSize(1.5 * 1024 * 1024)).toBe("1.5 MB");
  });
});

describe("sanitizeFileName", () => {
  it("убирает запрещённые символы", () => {
    expect(sanitizeFileName('file<name>.md')).toBe("filename.md");
    expect(sanitizeFileName('file:name.md')).toBe("filename.md");
    expect(sanitizeFileName('file"name.md')).toBe("filename.md");
    expect(sanitizeFileName("file|name.md")).toBe("filename.md");
    expect(sanitizeFileName("file?name.md")).toBe("filename.md");
    expect(sanitizeFileName("file*name.md")).toBe("filename.md");
  });

  it("убирает обратный слэш", () => {
    expect(sanitizeFileName("file\\name.md")).toBe("filename.md");
  });

  it("обрезает пробелы по краям", () => {
    expect(sanitizeFileName("  file.md  ")).toBe("file.md");
  });

  it("возвращает 'prompt' для пустой строки", () => {
    expect(sanitizeFileName("")).toBe("prompt");
    expect(sanitizeFileName("   ")).toBe("prompt");
    expect(sanitizeFileName('<>:"/\\|?*')).toBe("prompt");
  });

  it("не трогает нормальные имена", () => {
    expect(sanitizeFileName("my-file.md")).toBe("my-file.md");
    expect(sanitizeFileName("prompt-1.md")).toBe("prompt-1.md");
  });
});

describe("generateId", () => {
  it("возвращает строку", () => {
    expect(typeof generateId()).toBe("string");
  });

  it("генерирует уникальные значения", () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId()));
    expect(ids.size).toBe(100);
  });
});

describe("pluralize", () => {
  const p = (n: number) => pluralize(n, "файл", "файла", "файлов");

  it("1 → единственное число", () => {
    expect(p(1)).toBe("файл");
    expect(p(21)).toBe("файл");
    expect(p(31)).toBe("файл");
    expect(p(101)).toBe("файл");
  });

  it("2-4 → немножественное число", () => {
    expect(p(2)).toBe("файла");
    expect(p(3)).toBe("файла");
    expect(p(4)).toBe("файла");
    expect(p(22)).toBe("файла");
    expect(p(33)).toBe("файла");
    expect(p(44)).toBe("файла");
  });

  it("5-20 → множественное число", () => {
    expect(p(0)).toBe("файлов");
    expect(p(5)).toBe("файлов");
    expect(p(10)).toBe("файлов");
    expect(p(11)).toBe("файлов");
    expect(p(12)).toBe("файлов");
    expect(p(13)).toBe("файлов");
    expect(p(14)).toBe("файлов");
    expect(p(19)).toBe("файлов");
    expect(p(20)).toBe("файлов");
  });

  it("25-30 → немножественное число", () => {
    expect(p(25)).toBe("файлов");
    expect(p(26)).toBe("файлов");
    expect(p(27)).toBe("файлов");
    expect(p(28)).toBe("файлов");
    expect(p(29)).toBe("файлов");
    expect(p(30)).toBe("файлов");
  });

  it("111-119 → множественное число", () => {
    expect(p(111)).toBe("файлов");
    expect(p(112)).toBe("файлов");
    expect(p(113)).toBe("файлов");
    expect(p(114)).toBe("файлов");
    expect(p(119)).toBe("файлов");
  });
});

describe("getErrorMessage", () => {
  it("извлекает message из Error", () => {
    const error = new Error("что-то сломалось");
    expect(getErrorMessage(error, "fallback")).toBe("что-то сломалось");
  });

  it("возвращает строку, если передана непустая строка", () => {
    expect(getErrorMessage("текст ошибки", "fallback")).toBe("текст ошибки");
  });

  it("возвращает fallback для пустой строки", () => {
    expect(getErrorMessage("", "fallback")).toBe("fallback");
  });

  it("возвращает fallback для не-ошибки", () => {
    expect(getErrorMessage(42, "fallback")).toBe("fallback");
    expect(getErrorMessage(null, "fallback")).toBe("fallback");
    expect(getErrorMessage(undefined, "fallback")).toBe("fallback");
    expect(getErrorMessage({}, "fallback")).toBe("fallback");
  });
});

describe("createFlushableAsync", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("вызывает функцию после задержки", async () => {
    const fn = vi.fn().mockResolvedValue(undefined);
    const schedule = createFlushableAsync(fn, 800);

    schedule();
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(800);
    await vi.runAllTimersAsync();

    expect(fn).toHaveBeenCalledOnce();
  });

  it("не вызывает функцию повторно без нового вызова", async () => {
    const fn = vi.fn().mockResolvedValue(undefined);
    const schedule = createFlushableAsync(fn, 800);

    schedule();
    vi.advanceTimersByTime(800);
    await vi.runAllTimersAsync();

    vi.advanceTimersByTime(800);
    await vi.runAllTimersAsync();

    expect(fn).toHaveBeenCalledOnce();
  });

  it("debounce: несколько вызовов подряд → один вызов функции", async () => {
    const fn = vi.fn().mockResolvedValue(undefined);
    const schedule = createFlushableAsync(fn, 800);

    schedule();
    schedule();
    schedule();

    vi.advanceTimersByTime(800);
    await vi.runAllTimersAsync();

    expect(fn).toHaveBeenCalledOnce();
  });

  it("flush вызывает функцию немедленно", async () => {
    const fn = vi.fn().mockResolvedValue(undefined);
    const schedule = createFlushableAsync(fn, 800);

    schedule();
    await schedule.flush();

    expect(fn).toHaveBeenCalledOnce();
  });

  it("flush без вызова ничего не делает", async () => {
    const fn = vi.fn().mockResolvedValue(undefined);
    const schedule = createFlushableAsync(fn, 800);

    await schedule.flush();

    expect(fn).not.toHaveBeenCalled();
  });

  it("cancel отменяет запланированный вызов", async () => {
    const fn = vi.fn().mockResolvedValue(undefined);
    const schedule = createFlushableAsync(fn, 800);

    schedule();
    schedule.cancel();

    vi.advanceTimersByTime(800);
    await vi.runAllTimersAsync();

    expect(fn).not.toHaveBeenCalled();
  });

  it("не падает при ошибке в функции", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const fn = vi.fn().mockRejectedValue(new Error("fail"));
    const schedule = createFlushableAsync(fn, 800);

    schedule();
    vi.advanceTimersByTime(800);
    await vi.runAllTimersAsync();

    expect(fn).toHaveBeenCalledOnce();
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});