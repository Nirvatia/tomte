<script lang="ts">
  // Шрифты из сборки, а не с Google Fonts: работают офлайн (PWA) и не
  // ходят к сторонним серверам. Variable-версии: один файл на все начертания,
  // браузер грузит только нужные наборы символов (unicode-range).
  import "@fontsource-variable/inter/wght.css";
  import "@fontsource-variable/inter/wght-italic.css";
  import "@fontsource-variable/jetbrains-mono/wght.css";
  import "../app.css";
  import { onMount } from "svelte";
  import { Toaster } from "svelte-sonner";
  import ConfirmModal from "../components/ui/ConfirmModal.svelte";
  import { trackAppHeight } from "$lib/viewport";
  import { applyTheme, theme } from "$lib/theme";
  import { registerServiceWorker } from "$lib/serviceWorker";
  import { confirmDecisions } from "$lib/projectDecisions";
  import { setProjectDecisions } from "../utils/projectActions";

  let { children } = $props();

  // Вопросы действий над проектом (лимиты, токен) — окнами подтверждения.
  // До монтирования страницы: её onMount уже может вызвать действия.
  setProjectDecisions(confirmDecisions);

  // Высота приложения на телефоне: адресная строка и клавиатура (этап 11.2).
  onMount(() => trackAppHeight());

  // Тема: data-theme на <html> следует за выбором и за системой.
  $effect(() => applyTheme($theme));

  // PWA: кэш для работы без сети и уведомление об обновлении (только прод).
  onMount(() => registerServiceWorker());
</script>

<svelte:head>
  <title>Tomte // loves prompte</title>
  <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
  <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
  <link rel="icon" type="image/png" sizes="57x57" href="/favicon-57x57.png" />
  <link rel="icon" type="image/png" sizes="60x60" href="/favicon-60x60.png" />
  <link rel="icon" type="image/png" sizes="72x72" href="/favicon-72x72.png" />
  <link rel="icon" type="image/png" sizes="76x76" href="/favicon-76x76.png" />
  <link rel="icon" type="image/png" sizes="96x96" href="/favicon-96x96.png" />
  <link rel="apple-touch-icon" sizes="57x57" href="/favicon-57x57.png" />
  <link rel="apple-touch-icon" sizes="60x60" href="/favicon-60x60.png" />
  <link rel="apple-touch-icon" sizes="72x72" href="/favicon-72x72.png" />
  <link rel="apple-touch-icon" sizes="76x76" href="/favicon-76x76.png" />
</svelte:head>

<div class="app-root flex flex-col bg-[var(--bg-darkest)]">
  {@render children()}
</div>

<ConfirmModal />
<!-- offset: над строкой состояния (28px), иначе уведомления на неё наезжают -->
<Toaster
  position="bottom-right"
  theme={$theme}
  richColors
  closeButton
  offset="44px"
/>
