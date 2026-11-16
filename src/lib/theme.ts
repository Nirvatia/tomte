import { browser } from "$app/environment";
import { derived, readable, writable } from "svelte/store";

/**
 * Тема интерфейса: выбор пользователя («как в системе», светлая, тёмная)
 * и тема, которая в итоге применена. Применённая ставится на <html> как
 * data-theme; токены в app.css переопределяются для data-theme="light".
 *
 * Первую отрисовку тему ставит скрипт в app.html (иначе на светлой системе
 * мелькал бы тёмный экран): ключ хранилища и логика выбора там те же.
 */

export type ThemePreference = "system" | "light" | "dark";
export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "tomte:theme";
export const THEME_PREFERENCES: ThemePreference[] = ["system", "light", "dark"];

/** Цвет строки браузера и заголовка установленного приложения. */
const THEME_COLOR: Record<Theme, string> = {
  dark: "#141819",
  light: "#f0f3f3",
};

function readPreference(): ThemePreference {
  if (!browser) return "system";
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === "light" || saved === "dark" || saved === "system") {
      return saved;
    }
  } catch {
    // без хранилища — как в системе
  }
  return "system";
}

export const themePreference = writable<ThemePreference>(readPreference());

themePreference.subscribe((value) => {
  if (!browser) return;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, value);
  } catch {
    // выбор просто не переживёт перезагрузку
  }
});

/** Тема системы, обновляется при её смене. */
const systemTheme = readable<Theme>("dark", (set) => {
  if (!browser) return;
  const media = window.matchMedia("(prefers-color-scheme: light)");
  const update = () => set(media.matches ? "light" : "dark");
  update();
  media.addEventListener("change", update);
  return () => media.removeEventListener("change", update);
});

export function resolveTheme(
  preference: ThemePreference,
  system: Theme,
): Theme {
  return preference === "system" ? system : preference;
}

export const theme = derived(
  [themePreference, systemTheme],
  ([$preference, $system]) => resolveTheme($preference, $system),
);

/** Применяет тему к документу: data-theme и цвет строки браузера. */
export function applyTheme(value: Theme): void {
  const root = document.documentElement;
  root.dataset.theme = value;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", THEME_COLOR[value]);
}
