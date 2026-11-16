/**
 * Ставит фокус на элемент при его появлении.
 * Замена атрибуту autofocus: тот срабатывает только при загрузке страницы
 * и даёт предупреждение a11y в Svelte.
 * Второй аргумент — условие: без него фокус ставится всегда, с false —
 * пропуск (удобно в {#each} на первом элементе).
 */
export function autofocus(node: HTMLElement, enabled: boolean = true): void {
  if (!enabled) return;
  // Даём браузеру вставить элемент в DOM, затем фокусируем; в поле ввода
  // ещё и выделяем текст.
  queueMicrotask(() => {
    node.focus();
    if (
      node instanceof HTMLInputElement ||
      node instanceof HTMLTextAreaElement
    ) {
      node.select();
    }
  });
}
