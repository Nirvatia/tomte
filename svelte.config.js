import adapter from '@sveltejs/adapter-auto';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  // Этот препроцессор критически важен, чтобы Svelte читал Tailwind v4 внутри <style>
  preprocess: vitePreprocess(),

  compilerOptions: {
    // Включаем руны Svelte 5 глобально
    runes: true 
  },

  kit: {
    adapter: adapter()
  }
};

export default config;