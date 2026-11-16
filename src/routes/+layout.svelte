<script lang="ts">
  import "../app.css";
  import { onMount } from "svelte";
  import { Toaster } from "svelte-sonner";
  import ConfirmModal from "../components/ui/ConfirmModal.svelte";
  import { trackAppHeight } from "$lib/viewport";
  import { applyTheme, theme } from "$lib/theme";

  let { children } = $props();

  // Этап 10.7 (PWA): кэшируем приложение для работы без сети.
  // Только прод: в dev service worker мешал бы горячей перезагрузке.
  onMount(() => trackAppHeight());

  // Тема: data-theme на <html> следует за выбором и за системой.
  $effect(() => applyTheme($theme));

  onMount(() => {
    if (import.meta.env.PROD && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/service-worker.js").catch((error) => {
        console.error("Service worker registration failed:", error);
      });
    }
  });
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
