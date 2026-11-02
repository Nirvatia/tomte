/**
 * Размеры контекстного окна для индикатора в строке состояния.
 *
 * Значения меняются с выходом новых моделей, а сторонние справочники
 * расходятся между собой. Здесь только то, в чём они сходились
 * на дату проверки. Если модели нет или лимит другой — «Свой лимит».
 */
export const MODELS_CHECKED_AT = "2026-11";

export interface ModelPreset {
  id: string;
  label: string;
  contextTokens: number;
}

export const MODEL_PRESETS: ModelPreset[] = [
  { id: "claude-1m", label: "Claude Sonnet / Opus", contextTokens: 1_000_000 },
  { id: "claude-haiku", label: "Claude Haiku", contextTokens: 200_000 },
  { id: "gpt-5-5", label: "GPT-5.5", contextTokens: 1_050_000 },
  { id: "gpt-5", label: "GPT-5", contextTokens: 400_000 },
  { id: "gemini-pro", label: "Gemini 3 Pro", contextTokens: 1_000_000 },
  { id: "small-32k", label: "Небольшая модель (32K)", contextTokens: 32_000 },
];

export const CUSTOM_MODEL_ID = "custom";
