import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [
    tailwindcss(), 
    sveltekit() // Чистый вызов без аргументов, он сам пойдет и прочитает svelte.config.js
  ],
});