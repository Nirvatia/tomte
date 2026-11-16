import { describe, it, expect, beforeEach, vi } from "vitest";
import { get } from "svelte/store";

describe("theme", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  it("выбор пользователя важнее системы, «как в системе» — за ней", async () => {
    const { resolveTheme } = await import("../../src/lib/theme");
    expect(resolveTheme("light", "dark")).toBe("light");
    expect(resolveTheme("dark", "light")).toBe("dark");
    expect(resolveTheme("system", "light")).toBe("light");
    expect(resolveTheme("system", "dark")).toBe("dark");
  });

  it("по умолчанию — как в системе, выбор сохраняется", async () => {
    const { themePreference, THEME_STORAGE_KEY } =
      await import("../../src/lib/theme");
    expect(get(themePreference)).toBe("system");
    themePreference.set("light");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
  });

  it("мусор в хранилище не ломает выбор", async () => {
    localStorage.setItem("tomte:theme", "purple");
    const { themePreference } = await import("../../src/lib/theme");
    expect(get(themePreference)).toBe("system");
  });

  it("applyTheme ставит data-theme и цвет строки браузера", async () => {
    const meta = document.createElement("meta");
    meta.name = "theme-color";
    document.head.append(meta);
    const { applyTheme } = await import("../../src/lib/theme");

    applyTheme("light");
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(meta.getAttribute("content")).toBe("#ebeee3");

    applyTheme("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(meta.getAttribute("content")).toBe("#141819");
    meta.remove();
  });
});
