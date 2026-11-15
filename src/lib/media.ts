import { browser } from "$app/environment";
import { readable } from "svelte/store";

/**
 * Этап 9 (адаптив). Точка перехода «ноутбук ↔ планшет/телефон»:
 * от 1024px сайдбар стоит в ряду и ресайзится, ниже — выезжает поверх
 * редактора. Значение из matchMedia, обновляется при повороте окна.
 */
export const DESKTOP_QUERY = "(min-width: 1024px)";

export const isDesktop = readable<boolean>(true, (set) => {
  if (!browser) return;
  const media = window.matchMedia(DESKTOP_QUERY);
  const update = () => set(media.matches);
  update();
  media.addEventListener("change", update);
  return () => media.removeEventListener("change", update);
});
