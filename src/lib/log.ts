/**
 * Журнал ошибок (этап 15.3).
 *
 * logError / logWarn — для разработчика: консоль с общим префиксом.
 * reportError — сбой, о котором должен узнать пользователь: в журнал и
 * в уведомление. Уведомление подключает интерфейс (setErrorReporter в
 * +layout.svelte), поэтому сообщать о сбоях могут и модули данных,
 * не завися от интерфейса. Без подключённого получателя — только журнал.
 */

const PREFIX = "[Tomte]";

type Reporter = (message: string) => void;

let reporter: Reporter | null = null;

export function setErrorReporter(fn: Reporter | null): void {
  reporter = fn;
}

export function logError(context: string, error?: unknown): void {
  console.error(
    `${PREFIX} ${context}`,
    ...(error === undefined ? [] : [error]),
  );
}

export function logWarn(context: string, detail?: unknown): void {
  console.warn(
    `${PREFIX} ${context}`,
    ...(detail === undefined ? [] : [detail]),
  );
}

/** Сбой, который пользователь должен увидеть: журнал + уведомление. */
export function reportError(
  context: string,
  error: unknown,
  userMessage: string,
): void {
  logError(context, error);
  reporter?.(userMessage);
}
