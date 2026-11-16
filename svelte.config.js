import adapter from "@sveltejs/adapter-static";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

/** @type {import('@sveltejs/kit').Config} */
const config = {
  // Этот препроцессор критически важен, чтобы Svelte читал Tailwind v4 внутри <style>
  preprocess: vitePreprocess(),

  compilerOptions: {
    // Включаем руны Svelte 5 глобально
    runes: true,
  },

  kit: {
    // Этап 10.7 (PWA): статическая сборка, приложение целиком клиентское.
    // fallback отдаёт shell для любого маршрута и для офлайн-навигации.
    adapter: adapter({ fallback: "200.html" }),
    // Регистрируем сами и только в проде (src/lib/serviceWorker.ts):
    // авторегистрация включала его и в dev.
    serviceWorker: { register: false },
  },
};

export default config;
