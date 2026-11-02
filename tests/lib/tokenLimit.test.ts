import { describe, it, expect, beforeEach, vi } from "vitest";
import { get } from "svelte/store";

describe("tokenLimit", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  it("жёлтый с 80%, красный при превышении", async () => {
    const { usageLevel } = await import("../../src/lib/tokenLimit");
    expect(usageLevel(79, 100)).toBe("ok");
    expect(usageLevel(80, 100)).toBe("warn");
    expect(usageLevel(100, 100)).toBe("warn");
    expect(usageLevel(101, 100)).toBe("over");
    expect(usageLevel(5, 0)).toBe("ok");
  });

  it("короткая запись лимита", async () => {
    const { formatTokensShort } = await import("../../src/lib/tokenLimit");
    expect(formatTokensShort(1_050_000)).toBe("1,05M");
    expect(formatTokensShort(200_000)).toBe("200K");
    expect(formatTokensShort(32_000)).toBe("32K");
    expect(formatTokensShort(900)).toBe("900");
  });

  it("свой лимит и выбор модели переживают перезагрузку", async () => {
    let mod = await import("../../src/lib/tokenLimit");
    mod.tokenLimitSetting.set({ modelId: "custom", customTokens: 50_000 });

    vi.resetModules();
    (await import("../../src/lib/i18n")).locale.set("ru");
    mod = await import("../../src/lib/tokenLimit");
    expect(get(mod.tokenLimit)).toEqual({
      tokens: 50_000,
      label: "Свой лимит",
    });
  });

  it("неизвестная модель или мусор в хранилище — значение по умолчанию", async () => {
    localStorage.setItem(
      "tomte:tokenLimit",
      JSON.stringify({ modelId: "gone", customTokens: -5 }),
    );
    const { tokenLimitSetting } = await import("../../src/lib/tokenLimit");
    const { MODEL_PRESETS } = await import("../../src/lib/models");
    expect(get(tokenLimitSetting)).toEqual({
      modelId: MODEL_PRESETS[0].id,
      customTokens: 128_000,
    });

    vi.resetModules();
    localStorage.setItem("tomte:tokenLimit", "{not json");
    const again = await import("../../src/lib/tokenLimit");
    expect(get(again.tokenLimitSetting).modelId).toBe(MODEL_PRESETS[0].id);
  });
});
