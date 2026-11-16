import { toast } from "svelte-sonner";

import { translate } from "./i18n";
import { flushPendingEditorSave } from "../utils/projectActions";
import { logError } from "$lib/log";

/**
 * Этап 10.7 / 12.2–12.3. Регистрация сервис-воркера и обновление приложения.
 *
 * Автоматическая регистрация SvelteKit выключена (svelte.config.js): в dev
 * сервис-воркер мешал бы горячей перезагрузке, поэтому регистрируем сами
 * и только в проде.
 *
 * Новая версия скачивается фоном и ждёт (skipWaiting сам по себе не
 * вызывается: открытые вкладки не должны лишиться своих чанков). Пользователь
 * видит уведомление «Доступна новая версия · Обновить»; по кнопке текст
 * редактора сохраняется, новая версия активируется, страница перезагружается.
 */

export const SKIP_WAITING_MESSAGE = "tomte:skip-waiting";

/** Как часто проверять обновление, пока вкладка открыта. */
const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

let updateRequested = false;
let offered: ServiceWorker | null = null;

function offerUpdate(worker: ServiceWorker): void {
  if (offered === worker) return;
  offered = worker;
  toast(translate("app.update.available"), {
    id: "app-update",
    duration: Infinity,
    action: {
      label: translate("app.update.reload"),
      onClick: () => void applyUpdate(worker),
    },
  });
}

async function applyUpdate(worker: ServiceWorker): Promise<void> {
  updateRequested = true;
  try {
    await flushPendingEditorSave();
  } finally {
    worker.postMessage({ type: SKIP_WAITING_MESSAGE });
  }
}

/** Следит за установкой новой версии и предлагает обновиться. */
export function watchForUpdates(registration: ServiceWorkerRegistration): void {
  // Новая версия могла скачаться ещё в прошлый раз и ждать.
  if (registration.waiting && navigator.serviceWorker.controller) {
    offerUpdate(registration.waiting);
  }
  registration.addEventListener("updatefound", () => {
    const installing = registration.installing;
    if (!installing) return;
    installing.addEventListener("statechange", () => {
      // Без controller это первая установка, а не обновление.
      if (
        installing.state === "installed" &&
        navigator.serviceWorker.controller
      ) {
        offerUpdate(installing);
      }
    });
  });

  // Перезагружаемся, только если обновление попросил пользователь:
  // controllerchange бывает и при первой установке (clients.claim).
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (updateRequested) window.location.reload();
  });
}

export function registerServiceWorker(): () => void {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) {
    return () => {};
  }

  let timer: ReturnType<typeof setInterval> | undefined;
  let registration: ServiceWorkerRegistration | undefined;
  const check = () => void registration?.update().catch(() => {});
  const onVisible = () => {
    if (document.visibilityState === "visible") check();
  };

  navigator.serviceWorker
    .register("/service-worker.js")
    .then((value) => {
      registration = value;
      watchForUpdates(value);
      timer = setInterval(check, UPDATE_CHECK_INTERVAL_MS);
      document.addEventListener("visibilitychange", onVisible);
    })
    .catch((error) => {
      logError("Service worker registration failed", error);
    });

  return () => {
    clearInterval(timer);
    document.removeEventListener("visibilitychange", onVisible);
  };
}
