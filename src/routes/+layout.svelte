<script lang="ts">
  import "../app.css";
  import ConfirmModal from "../components/ui/ConfirmModal.svelte";

  let { children } = $props();
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

<div class="flex h-screen flex-col overflow-hidden bg-[var(--bg-darkest)]">
  {@render children()}
</div>

<ConfirmModal />