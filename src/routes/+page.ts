// Этап 10.7 (PWA): корень prerender'ится в index.html — service worker
// кладёт его в прекэш как офлайн-оболочку. Остальные маршруты (если
// появятся) закрывает fallback 200.html от adapter-static.
export const prerender = true;
