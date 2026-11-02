import { describe, it, expect, afterEach } from "vitest";
import { get } from "svelte/store";

import {
  detectLocale,
  formatRelativeTime,
  locale,
  t,
  translateIn,
} from "../../../src/lib/i18n";

describe("i18n", () => {
  afterEach(() => locale.set("ru"));

  it("язык браузера: ru и es поддерживаются, остальное — английский", () => {
    expect(detectLocale(["ru-RU", "en"])).toBe("ru");
    expect(detectLocale(["es-MX"])).toBe("es");
    expect(detectLocale(["de-DE", "es"])).toBe("es");
    expect(detectLocale(["fr-FR"])).toBe("en");
    expect(detectLocale([])).toBe("en");
  });

  it("склонения в русском: one / few / many", () => {
    expect(translateIn("ru", "projects.prompts", { count: 1 })).toBe(
      "1 промпт",
    );
    expect(translateIn("ru", "projects.prompts", { count: 3 })).toBe(
      "3 промпта",
    );
    expect(translateIn("ru", "projects.prompts", { count: 5 })).toBe(
      "5 промптов",
    );
    expect(translateIn("ru", "projects.prompts", { count: 21 })).toBe(
      "21 промпт",
    );
    expect(translateIn("ru", "projects.prompts", { count: 12 })).toBe(
      "12 промптов",
    );
  });

  it("склонения в английском и испанском", () => {
    expect(translateIn("en", "projects.prompts", { count: 1 })).toBe(
      "1 prompt",
    );
    expect(translateIn("en", "projects.prompts", { count: 2 })).toBe(
      "2 prompts",
    );
    expect(translateIn("es", "projects.attachments", { count: 1 })).toBe(
      "1 adjunto",
    );
    expect(translateIn("es", "projects.attachments", { count: 7 })).toBe(
      "7 adjuntos",
    );
    // Для круглых больших чисел испанский выбирает форму many.
    expect(
      translateIn("es", "projects.attachments", { count: 1_000_000 }),
    ).toContain("adjuntos");
  });

  it("подстановки и формат чисел по языку", () => {
    expect(translateIn("en", "prompts.deleted", { name: "a.md" })).toBe(
      "File “a.md” deleted",
    );
    expect(translateIn("ru", "common.chars", { count: 1234 })).toBe(
      "1\u00a0234 символа",
    );
    expect(translateIn("en", "common.chars", { count: 1234 })).toBe(
      "1,234 characters",
    );
  });

  it("$t переключается вместе с языком", () => {
    locale.set("en");
    expect(get(t)("common.save")).toBe("Save");
    locale.set("es");
    expect(get(t)("common.save")).toBe("Guardar");
  });

  it("относительное время на языке интерфейса", () => {
    const now = Date.parse("2026-01-01T12:00:00Z");
    locale.set("en");
    expect(formatRelativeTime("2026-01-01T11:55:00Z", now)).toBe(
      "5 minutes ago",
    );
    locale.set("ru");
    expect(formatRelativeTime("2026-01-01T11:55:00Z", now)).toBe(
      "5 минут назад",
    );
  });
});
