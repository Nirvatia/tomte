/**
 * Клавиатура для role="menu": фокус на первый пункт при открытии,
 * стрелки и Home/End ходят по пунктам, Escape закрывает меню.
 * Tab не перехватываем: в меню бывают не только пункты (чекбокс в меню экспорта).
 */
export interface MenuOptions {
  onClose: () => void;
  /** Куда вернуть фокус после закрытия (кнопка, открывшая меню). */
  returnFocus?: HTMLElement | null;
}

export function menu(node: HTMLElement, options: MenuOptions) {
  let current = options;
  const items = () =>
    Array.from(
      node.querySelectorAll<HTMLElement>(
        '[role="menuitem"]:not([disabled]), [role="menuitemcheckbox"]:not([disabled])',
      ),
    );

  queueMicrotask(() => items()[0]?.focus());

  function close() {
    current.onClose();
    current.returnFocus?.focus();
  }

  function onKeydown(event: KeyboardEvent) {
    const list = items();
    const index = list.indexOf(document.activeElement as HTMLElement);
    const focusAt = (i: number) =>
      list[(i + list.length) % list.length]?.focus();

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        focusAt(index + 1);
        break;
      case "ArrowUp":
        event.preventDefault();
        focusAt(index - 1);
        break;
      case "Home":
        event.preventDefault();
        focusAt(0);
        break;
      case "End":
        event.preventDefault();
        focusAt(list.length - 1);
        break;
      case "Escape":
        event.preventDefault();
        event.stopPropagation();
        close();
        break;
    }
  }

  node.addEventListener("keydown", onKeydown);
  return {
    update(next: MenuOptions) {
      current = next;
    },
    destroy() {
      node.removeEventListener("keydown", onKeydown);
    },
  };
}
