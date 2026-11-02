import { toast } from "svelte-sonner";

/**
 * Уведомления внизу справа. Все тексты для пользователя идут через этот
 * модуль, чтобы длительность и формат были одинаковыми.
 */

/** Сколько живёт уведомление с «Отменить». */
export const UNDO_DURATION_MS = 5000;

export type UndoFn = () => Promise<void> | void;

/** «Файл удалён. Отменить» */
export function notifyUndo(message: string, undo: UndoFn): void {
  toast(message, {
    duration: UNDO_DURATION_MS,
    action: {
      label: "Отменить",
      onClick: () => {
        Promise.resolve(undo()).catch((error) => {
          console.error("Undo failed:", error);
          notifyError("Не удалось отменить удаление");
        });
      },
    },
  });
}

/** Ошибка; с retry — кнопка «Повторить». Висит, пока её не закроют. */
export function notifyError(message: string, retry?: () => void): void {
  toast.error(message, {
    duration: retry ? Infinity : 8000,
    action: retry ? { label: "Повторить", onClick: retry } : undefined,
  });
}

export function notifyInfo(message: string): void {
  toast(message);
}
