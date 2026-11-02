import { derived, writable } from "svelte/store";

import { CUSTOM_MODEL_ID, MODEL_PRESETS } from "./models";

/**
 * С какой моделью сравниваем размер промпта. Это настройка этого браузера,
 * а не данные проекта, поэтому лежит в localStorage.
 */
export interface TokenLimitSetting {
  modelId: string;
  customTokens: number;
}

const KEY = "tomte:tokenLimit";
const DEFAULT: TokenLimitSetting = {
  modelId: MODEL_PRESETS[0].id,
  customTokens: 128_000,
};

function load(): TokenLimitSetting {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT;
    const parsed = JSON.parse(raw) as Partial<TokenLimitSetting>;
    return {
      modelId:
        parsed.modelId === CUSTOM_MODEL_ID ||
        MODEL_PRESETS.some((m) => m.id === parsed.modelId)
          ? parsed.modelId!
          : DEFAULT.modelId,
      customTokens:
        Number.isFinite(parsed.customTokens) && parsed.customTokens! > 0
          ? Math.round(parsed.customTokens!)
          : DEFAULT.customTokens,
    };
  } catch {
    return DEFAULT;
  }
}

export const tokenLimitSetting = writable<TokenLimitSetting>(
  typeof localStorage === "undefined" ? DEFAULT : load(),
);

tokenLimitSetting.subscribe((value) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(value));
  } catch {
    // Без хранилища настройка просто не переживёт перезагрузку.
  }
});

/** Текущий лимит в токенах и подпись для него. */
export const tokenLimit = derived(tokenLimitSetting, ($s) => {
  if ($s.modelId === CUSTOM_MODEL_ID) {
    return { tokens: $s.customTokens, label: "Свой лимит" };
  }
  const preset =
    MODEL_PRESETS.find((m) => m.id === $s.modelId) ?? MODEL_PRESETS[0];
  return { tokens: preset.contextTokens, label: preset.label };
});

export type UsageLevel = "ok" | "warn" | "over";

/** Решение этапа 5: жёлтый с 80%, красный при превышении. */
export function usageLevel(used: number, limit: number): UsageLevel {
  if (limit <= 0) return "ok";
  if (used > limit) return "over";
  if (used >= limit * 0.8) return "warn";
  return "ok";
}

/** 1 050 000 → «1,05M», 200 000 → «200K», 900 → «900». */
export function formatTokensShort(tokens: number): string {
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toLocaleString("ru-RU", { maximumFractionDigits: 2 })}M`;
  }
  if (tokens >= 1000) {
    return `${(tokens / 1000).toLocaleString("ru-RU", { maximumFractionDigits: 1 })}K`;
  }
  return String(tokens);
}
