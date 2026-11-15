import { get } from "svelte/store";

import { isExportMenuOpen, promptFiles } from "../../stores";
import type { Side } from "./position";

/**
 * Этап 5.8. Сценарий обучающего тура.
 *
 * Шаг привязан к элементу интерфейса через атрибут data-tour. Шаги
 * бывают двух видов: информационные (пояснение и «Далее») и шаги-действия,
 * где тур ждёт, пока пользователь сам нажмёт подсвеченную кнопку
 * или напишет текст, и только тогда идёт дальше.
 */

export type TourStepId =
  | "welcome"
  | "newPrompt"
  | "editor"
  | "toolbar"
  | "tags"
  | "attachments"
  | "tree"
  | "tokens"
  | "tokensPanel"
  | "export"
  | "exportMenu"
  | "activity"
  | "final";

export interface TourAction {
  /** Подпись метки у цели: «Нажмите сюда» или «Пишите здесь». */
  hint: "click" | "type";
  /**
   * Вызывается при входе в шаг, запоминает исходное состояние
   * и возвращает проверку «действие выполнено».
   */
  track: () => () => boolean;
  /**
   * auto — сразу перейти дальше (клик открыл панель, следующий шаг про неё);
   * manual — показать «Получилось!» и ждать «Далее» (пользователь ещё пишет).
   */
  advance: "auto" | "manual";
}

export interface TourStep {
  id: TourStepId;
  /** Значения data-tour по приоритету: берётся первый видимый элемент. */
  targets?: string[];
  /** Предпочтительные стороны для подсказки. */
  prefer?: Side[];
  /** Цель живёт в боковой панели: перед шагом панель раскрывается. */
  sidebar?: boolean;
  /** Только для широкого экрана (на телефоне такого элемента нет). */
  desktopOnly?: boolean;
  /**
   * Не забирать фокус в подсказку: цель — открытое меню или панель,
   * фокус уже в ней, и с клавиатуры ею должно быть можно пользоваться.
   */
  keepFocus?: boolean;
  action?: TourAction;
}

/** Текст редактора без разметки (для шага «напишите пару слов»). */
function editorText(): string {
  const editor = document.querySelector('[data-tour="editor"] .ProseMirror');
  return editor?.textContent?.trim() ?? "";
}

export const TOUR_STEPS: TourStep[] = [
  { id: "welcome" },
  {
    id: "newPrompt",
    targets: ["new-prompt"],
    prefer: ["right", "bottom"],
    sidebar: true,
    action: {
      hint: "click",
      advance: "auto",
      track: () => {
        const start = get(promptFiles).length;
        return () => get(promptFiles).length > start;
      },
    },
  },
  {
    id: "editor",
    targets: ["editor"],
    prefer: ["left", "bottom"],
    action: {
      hint: "type",
      advance: "manual",
      track: () => {
        const start = editorText();
        return () => {
          const now = editorText();
          return now.length > 0 && now !== start;
        };
      },
    },
  },
  { id: "toolbar", targets: ["toolbar"], prefer: ["bottom"] },
  { id: "tags", targets: ["tags"], prefer: ["top"] },
  {
    id: "attachments",
    targets: ["attachments"],
    prefer: ["right"],
    sidebar: true,
  },
  { id: "tree", targets: ["tree"], prefer: ["right"], sidebar: true },
  {
    id: "tokens",
    targets: ["tokens"],
    prefer: ["top"],
    action: {
      hint: "click",
      advance: "auto",
      track: () => () =>
        document.querySelector('[data-tour="tokens-panel"]') !== null,
    },
  },
  {
    id: "tokensPanel",
    targets: ["tokens-panel", "tokens"],
    prefer: ["left", "top"],
    keepFocus: true,
  },
  {
    id: "export",
    targets: ["export"],
    prefer: ["bottom", "left"],
    action: {
      hint: "click",
      advance: "auto",
      track: () => () => get(isExportMenuOpen),
    },
  },
  {
    id: "exportMenu",
    targets: ["export-menu", "export"],
    prefer: ["left", "bottom"],
    keepFocus: true,
  },
  {
    id: "activity",
    targets: ["activity"],
    prefer: ["right"],
    desktopOnly: true,
  },
  { id: "final" },
];

// ═══ Флаг «тур пройден» ═══

const STORAGE_KEY = "tomte:onboarded";
/**
 * Версия тура. Первая версия (значение «1») не показывала подсказки у
 * элементов, поэтому прошедшим её новый тур показывается ещё раз.
 */
export const TOUR_VERSION = "2";

export function shouldShowTour(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== TOUR_VERSION;
  } catch {
    // без хранилища тур показывался бы на каждом запуске
    return false;
  }
}

export function markTourSeen(): void {
  try {
    localStorage.setItem(STORAGE_KEY, TOUR_VERSION);
  } catch {
    // без хранилища тур просто покажется при следующем запуске
  }
}
