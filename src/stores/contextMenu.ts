import { writable } from "svelte/store";

export interface ContextMenuItem {
  label: string;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
  /** Подсказка справа, например сочетание клавиш. */
  hint?: string;
  /** Разделитель перед пунктом. */
  separatorBefore?: boolean;
}

export interface ContextMenuState {
  x: number;
  y: number;
  items: ContextMenuItem[];
  /** Куда вернуть фокус после закрытия. */
  returnFocus: HTMLElement | null;
}

export const contextMenu = writable<ContextMenuState | null>(null);

/**
 * Открывает меню по событию contextmenu. С клавиатуры (Shift+F10, клавиша Menu)
 * у события нет координат курсора — тогда ставим меню у элемента.
 */
export function openContextMenu(
  event: MouseEvent,
  items: ContextMenuItem[],
): void {
  event.preventDefault();
  event.stopPropagation();
  const target =
    event.currentTarget instanceof HTMLElement ? event.currentTarget : null;

  let { clientX: x, clientY: y } = event;
  if (x === 0 && y === 0 && target) {
    const rect = target.getBoundingClientRect();
    x = rect.left + 16;
    y = rect.bottom;
  }
  contextMenu.set({ x, y, items, returnFocus: target });
}

export function closeContextMenu(): void {
  contextMenu.set(null);
}
