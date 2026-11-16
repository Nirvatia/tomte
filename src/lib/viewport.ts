/**
 * Высота приложения на телефоне.
 *
 * 100vh на мобильных браузерах — высота окна без адресной строки, поэтому
 * низ приложения уходил под неё, а прокрутки не было. CSS берёт 100dvh
 * (учитывает адресную строку), но Safari на iOS не уменьшает dvh под
 * экранную клавиатуру: он сдвигает страницу вверх, и обрезался уже верх.
 * На сенсорных экранах высоту даёт visualViewport — видимая часть окна
 * над клавиатурой; её пишем в --app-height.
 */
export function trackAppHeight(): () => void {
  const viewport = window.visualViewport;
  // На десктопе visualViewport меняется от масштабирования щипком —
  // там достаточно dvh.
  if (!viewport || !window.matchMedia("(pointer: coarse)").matches) {
    return () => {};
  }

  const root = document.documentElement;
  const update = () => {
    root.style.setProperty("--app-height", `${Math.round(viewport.height)}px`);
    // Safari прокручивает страницу к полю ввода; приложение уже вписано
    // в видимую часть, сдвиг только прячет шапку.
    if (window.scrollY !== 0) window.scrollTo(0, 0);
  };

  update();
  viewport.addEventListener("resize", update);
  viewport.addEventListener("scroll", update);
  return () => {
    viewport.removeEventListener("resize", update);
    viewport.removeEventListener("scroll", update);
    root.style.removeProperty("--app-height");
  };
}
