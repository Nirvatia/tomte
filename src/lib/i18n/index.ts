import { derived, get, writable } from "svelte/store";

import { ru } from "./locales/ru";
import { en } from "./locales/en";
import { es } from "./locales/es";
import type { Dict, MessageKey, Plural } from "./types";

/**
 * Языки интерфейса (этап 7). При первом запуске язык берётся из браузера
 * (ru/es, иначе en), дальше — выбор пользователя из localStorage.
 *
 * Строки с параметрами: «Файл «{name}» удалён». Склонения: объект
 * { one, few, many, other }, форма выбирается по params.count через
 * Intl.PluralRules (в русском one/few/many, в английском one/other).
 */
export type Locale = "ru" | "en" | "es";

export const LOCALES: { id: Locale; label: string }[] = [
  { id: "ru", label: "Русский" },
  { id: "en", label: "English" },
  { id: "es", label: "Español" },
];

const DICTS: Record<Locale, Dict> = { ru, en, es };
const KEY = "tomte:locale";

function isLocale(value: unknown): value is Locale {
  return value === "ru" || value === "en" || value === "es";
}

/** Язык браузера → наш язык: ru и es поддерживаем, остальное — английский. */
export function detectLocale(languages: readonly string[]): Locale {
  for (const lang of languages) {
    const base = lang.toLowerCase().split("-")[0];
    if (isLocale(base)) return base;
  }
  return "en";
}

function initialLocale(): Locale {
  try {
    const saved = localStorage.getItem(KEY);
    if (isLocale(saved)) return saved;
  } catch {
    // без хранилища — по браузеру
  }
  if (typeof navigator === "undefined") return "en";
  return detectLocale(navigator.languages ?? [navigator.language]);
}

export const locale = writable<Locale>(
  typeof window === "undefined" ? "en" : initialLocale(),
);

locale.subscribe((value) => {
  try {
    localStorage.setItem(KEY, value);
  } catch {
    // выбор просто не переживёт перезагрузку
  }
  if (typeof document !== "undefined") document.documentElement.lang = value;
});

type Params = Record<string, string | number>;

function lookup(dict: Dict, key: string): string | Plural | undefined {
  let node: unknown = dict;
  for (const part of key.split(".")) {
    if (node === null || typeof node !== "object") return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return node as string | Plural | undefined;
}

function interpolate(
  template: string,
  params: Params | undefined,
  lang: Locale,
): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = params[name];
    if (value === undefined) return match;
    return typeof value === "number" ? value.toLocaleString(lang) : value;
  });
}

const pluralRules = new Map<Locale, Intl.PluralRules>();

function pluralForm(entry: Plural, count: number, lang: Locale): string {
  let rules = pluralRules.get(lang);
  if (!rules) {
    rules = new Intl.PluralRules(lang);
    pluralRules.set(lang, rules);
  }
  const category = rules.select(count) as keyof Plural;
  return entry[category] ?? entry.other;
}

export function translateIn(
  lang: Locale,
  key: MessageKey,
  params?: Params,
): string {
  const entry = lookup(DICTS[lang], key) ?? lookup(DICTS.en, key);
  if (entry === undefined) return key;
  const template =
    typeof entry === "string"
      ? entry
      : pluralForm(entry, Number(params?.count ?? 0), lang);
  return interpolate(template, params, lang);
}

/** Перевод вне компонентов (действия, экспорт, уведомления). */
export function translate(key: MessageKey, params?: Params): string {
  return translateIn(get(locale), key, params);
}

/** В компонентах: {$t("tabs.new")} — перерисуется при смене языка. */
export const t = derived(
  locale,
  ($locale) => (key: MessageKey, params?: Params) =>
    translateIn($locale, key, params),
);

/** Число в формате текущего языка: 1 234 / 1,234 / 1.234. */
export function formatNumber(value: number): string {
  return value.toLocaleString(get(locale));
}

/** «5 минут назад» на текущем языке. */
export function formatRelativeTime(iso: string, now = Date.now()): string {
  const diffSeconds = Math.round((new Date(iso).getTime() - now) / 1000);
  const rtf = new Intl.RelativeTimeFormat(get(locale), { numeric: "auto" });
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31_536_000],
    ["month", 2_592_000],
    ["week", 604_800],
    ["day", 86_400],
    ["hour", 3_600],
    ["minute", 60],
  ];
  for (const [unit, seconds] of units) {
    if (Math.abs(diffSeconds) >= seconds) {
      return rtf.format(Math.round(diffSeconds / seconds), unit);
    }
  }
  return rtf.format(0, "second");
}
