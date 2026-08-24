import { writable, get } from "svelte/store";

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  hideCancel?: boolean;
}

interface ConfirmState extends ConfirmOptions {
  open: boolean;
  resolve?: (value: boolean) => void;
}

const initialState: ConfirmState = {
  open: false,
  message: "",
  title: "",
  confirmText: "",
  cancelText: "",
  danger: false,
  hideCancel: false,
};

export const confirmState = writable<ConfirmState>(initialState);

/**
 * Вызывает модальное окно подтверждения и возвращает выбор пользователя.
 *
 * Использование:
 * const ok = await requestConfirm({ message: "Удалить файл?" });
 * if (!ok) return;
 */
export function requestConfirm(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    const current = get(confirmState);

    // Если уже открыт другой диалог, завершаем его как отменённый.
    if (current.open && current.resolve) {
      current.resolve(false);
    }

    confirmState.set({
      title: options.title ?? "Подтверждение",
      message: options.message,
      confirmText: options.confirmText ?? "Подтвердить",
      cancelText: options.cancelText ?? "Отмена",
      danger: options.danger ?? false,
      hideCancel: options.hideCancel ?? false,
      open: true,
      resolve,
    });
  });
}

/**
 * Аналог alert(), но в виде нормальной модалки.
 * Показывает только одну кнопку подтверждения.
 */
export function requestAlert(
  options: Omit<ConfirmOptions, "hideCancel" | "cancelText">
): Promise<boolean> {
  return requestConfirm({
    ...options,
    hideCancel: true,
    cancelText: "",
  });
}

export function closeConfirm(result: boolean): void {
  const current = get(confirmState);

  if (current.resolve) {
    current.resolve(result);
  }

  confirmState.set({ ...initialState });
}