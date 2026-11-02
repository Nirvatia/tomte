import type { MessageKey } from "./i18n/types";

/**
 * Горячие клавиши приложения (решение этапа 5). Один список служит и
 * обработчиком, и шпаргалкой, поэтому они не расходятся.
 *
 * Сочетания записываются как "Mod+Alt+N": Mod — Ctrl, на Mac — Cmd.
 * Буквы сравниваются по физической клавише (event.code), чтобы сочетания
 * работали и в русской раскладке. «?» — по символу (event.key).
 *
 * Ctrl+W, Ctrl+T, Ctrl+P не используем: браузер их не отдаёт или они нужны ему.
 * Ctrl+Shift+E/L/R заняты в редакторе выравниванием текста.
 */

export type HotkeyId =
  | "save"
  | "newFile"
  | "closeTab"
  | "quickOpen"
  | "export"
  | "nextTab"
  | "prevTab"
  | "help";

export interface Hotkey {
  id: HotkeyId;
  keys: string;
  /** Ключ словаря с описанием. */
  description: MessageKey;
  /** Срабатывает и при наборе текста (в редакторе, полях ввода). */
  whileTyping: boolean;
  /** Пометка для шпаргалки (ключ словаря). */
  note?: MessageKey;
}

export const HOTKEYS: Hotkey[] = [
  {
    id: "save",
    keys: "Mod+S",
    description: "hotkeys.save",
    whileTyping: true,
  },
  {
    id: "newFile",
    keys: "Mod+Alt+N",
    description: "hotkeys.newFile",
    whileTyping: true,
  },
  {
    id: "closeTab",
    keys: "Mod+Alt+W",
    description: "hotkeys.closeTab",
    whileTyping: true,
  },
  {
    id: "quickOpen",
    keys: "Mod+K",
    description: "hotkeys.quickOpen",
    whileTyping: true,
  },
  {
    id: "export",
    keys: "Mod+Alt+E",
    description: "hotkeys.export",
    whileTyping: true,
  },
  {
    id: "nextTab",
    keys: "Ctrl+Tab",
    description: "hotkeys.nextTab",
    whileTyping: true,
    note: "hotkeys.browserNote",
  },
  {
    id: "prevTab",
    keys: "Ctrl+Shift+Tab",
    description: "hotkeys.prevTab",
    whileTyping: true,
    note: "hotkeys.browserNote",
  },
  { id: "help", keys: "?", description: "hotkeys.help", whileTyping: false },
];

export function isMacPlatform(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
}

interface ParsedKeys {
  mod: boolean;
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  key: string;
}

function parse(keys: string): ParsedKeys {
  const parts = keys.split("+");
  const key = parts.pop()!;
  return {
    mod: parts.includes("Mod"),
    ctrl: parts.includes("Ctrl"),
    alt: parts.includes("Alt"),
    shift: parts.includes("Shift"),
    key,
  };
}

/** Код физической клавиши для буквы/цифры, иначе null (сравниваем по символу). */
function codeFor(key: string): string | null {
  if (/^[A-Z]$/.test(key)) return `Key${key}`;
  if (/^[0-9]$/.test(key)) return `Digit${key}`;
  if (key === "Tab") return "Tab";
  return null;
}

export function matchesHotkey(
  event: KeyboardEvent,
  keys: string,
  isMac = isMacPlatform(),
): boolean {
  const spec = parse(keys);
  const code = codeFor(spec.key);

  if (!code) {
    // Символ вроде «?»: Shift уже учтён в самом символе, остальное — без модификаторов.
    return (
      event.key === spec.key &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey
    );
  }

  const wantMeta = spec.mod && isMac;
  const wantCtrl = spec.ctrl || (spec.mod && !isMac);
  return (
    event.code === code &&
    event.ctrlKey === wantCtrl &&
    event.metaKey === wantMeta &&
    event.altKey === spec.alt &&
    event.shiftKey === spec.shift
  );
}

/** Подпись сочетания для шпаргалки и подсказок: «Ctrl+Alt+N» или «⌘⌥N». */
export function formatHotkey(keys: string, isMac = isMacPlatform()): string {
  const spec = parse(keys);
  // Не буква и не цифра («?», «Shift+F10», «Alt+↑ / Alt+↓») — показываем как записано.
  if (!codeFor(spec.key)) return keys;
  if (isMac) {
    return [
      spec.ctrl ? "⌃" : "",
      spec.alt ? "⌥" : "",
      spec.shift ? "⇧" : "",
      spec.mod ? "⌘" : "",
      spec.key,
    ].join("");
  }
  return [
    spec.mod || spec.ctrl ? "Ctrl" : "",
    spec.alt ? "Alt" : "",
    spec.shift ? "Shift" : "",
    spec.key,
  ]
    .filter(Boolean)
    .join("+");
}

export function hotkeyFor(id: HotkeyId): Hotkey {
  return HOTKEYS.find((h) => h.id === id)!;
}

/** Фокус в поле, где печатают текст: там одиночные клавиши вроде «?» не перехватываем. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  if (tag === "TEXTAREA" || tag === "SELECT") return true;
  if (tag !== "INPUT") return false;
  const type = (target as HTMLInputElement).type;
  return ![
    "checkbox",
    "radio",
    "button",
    "submit",
    "reset",
    "range",
    "color",
  ].includes(type);
}

/** Какая горячая клавиша нажата (с учётом того, печатает ли пользователь). */
export function findHotkey(
  event: KeyboardEvent,
  isMac = isMacPlatform(),
): Hotkey | null {
  const typing = isTypingTarget(event.target);
  for (const hotkey of HOTKEYS) {
    if (typing && !hotkey.whileTyping) continue;
    if (matchesHotkey(event, hotkey.keys, isMac)) return hotkey;
  }
  return null;
}
