/// <reference lib="webworker" />
import { build, version } from "$service-worker";

/**
 * Этап 10.7 (PWA). Приложение кэшируется целиком, чтобы работать без сети:
 * данные и так локальные (IndexedDB), не хватало только shell'а и WASM.
 *
 * - install: прекэш сборки (js/css) и HTML-оболочек;
 * - fetch: навигация — network-first с откатом на shell (офлайн);
 *   статика и /wasm/ — cache-first с фоновым наполнением кэша
 *   (грамматики tree-sitter ~21 МБ, прекэшить их все было бы расточительно);
 * - activate: кэши прошлых версий удаляются.
 *
 * skipWaiting намеренно не вызываем: новая версия применится при следующем
 * открытии, а уже открытые вкладки не словят исчезновение «своих» чанков
 * из удалённого кэша.
 */

const worker = self as unknown as ServiceWorkerGlobalScope;

const APP_CACHE = `app-${version}`;
const RUNTIME_CACHE = `runtime-${version}`;

// Сборка обязана встать целиком, оболочки — по одной: отсутствующий
// fallback-файл не должен ронять установку.
// Из шрифтов прекэшируем только латиницу и кириллицу (язык интерфейса):
// остальные наборы (latin-ext, greek, vietnamese…) браузер запросит, только
// если такие символы встретятся в тексте, и они лягут в кэш по запросу.
const isPrecachedAsset = (path: string) =>
  !path.endsWith(".woff2") || /-(latin|cyrillic)-wght-/.test(path);
const BUILD_ASSETS = build.filter(isPrecachedAsset);
const SHELL_PAGES = ["index.html", "200.html"];

worker.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(APP_CACHE);
      await cache.addAll(BUILD_ASSETS);
      await Promise.allSettled(SHELL_PAGES.map((page) => cache.add(page)));
    })(),
  );
});

// Пользователь нажал «Обновить» в уведомлении (src/lib/serviceWorker.ts).
worker.addEventListener("message", (event) => {
  if (event.data?.type === "tomte:skip-waiting") void worker.skipWaiting();
});

worker.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key !== APP_CACHE && key !== RUNTIME_CACHE)
          .map((key) => caches.delete(key)),
      );
      await worker.clients.claim();
    })(),
  );
});

worker.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== worker.location.origin) return;

  // Навигация: сеть, при недоступности — сохранённая оболочка.
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          return await fetch(request);
        } catch {
          return (
            (await caches.match(request)) ?? (await caches.match("index.html"))
          );
        }
      })(),
    );
    return;
  }

  // Статика и WASM: кэш первым, промахи кладём в кэш фоном.
  event.respondWith(
    (async () => {
      const cached = await caches.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok) {
        const cache = await caches.open(RUNTIME_CACHE);
        void cache.put(request, response.clone());
      }
      return response;
    })(),
  );
});
