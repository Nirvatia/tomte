/**
 * Ставит фокус на элемент при его появлении.
 * Замена атрибуту autofocus: тот срабатывает только при загрузке страницы
 * и даёт предупреждение a11y в Svelte.
 * Второй аргумент — условие: без него фокус ставится всегда, с false —
 * пропуск (удобно в {#each} на первом элементе).
 */
export function autofocus(
  node: HTMLInputElement | HTMLTextAreaElement,
  enabled: boolean = true,
): void {
  if (!enabled) return;
  // Даём браузеру вставить элемент в DOM, затем фокусируем и выделяем текст.
  queueMicrotask(() => {
    node.focus();
    node.select();
  });
}
