/**
 * Ставит фокус на элемент при его появлении.
 * Замена атрибуту autofocus: тот срабатывает только при загрузке страницы
 * и даёт предупреждение a11y в Svelte.
 */
export function autofocus(node: HTMLInputElement | HTMLTextAreaElement): void {
  // Даём браузеру вставить элемент в DOM, затем фокусируем и выделяем текст.
  queueMicrotask(() => {
    node.focus();
    node.select();
  });
}
