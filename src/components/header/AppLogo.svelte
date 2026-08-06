<!-- AppLogo.svelte -->
<script lang="ts">
  let { size = "default" }: { size?: "default" | "compact" } = $props();

  const sizes = {
    default: {
      container: "flex select-none items-center gap-3",
      icon: "relative grid h-10 w-10 place-items-center rounded-[10px] bg-gradient-to-br from-brand-500 to-purple-600 shadow-glow",
      iconText: "text-xl font-black text-[#16130c]",
      title: "text-[17px] font-extrabold leading-none tracking-tight text-txt",
      subtitle:
        "mt-1 font-mono text-[9.5px] font-medium uppercase leading-none tracking-[0.2em] text-txt3",
    },
    compact: {
      container: "flex select-none items-center gap-2.5",
      icon: "relative grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-brand-500 to-purple-600 shadow-glow",
      iconText: "text-sm font-black text-[#16130c]",
      title: "text-[15px] font-extrabold leading-none tracking-tight text-txt",
      subtitle:
        "mt-0.5 font-mono text-[9px] font-medium uppercase leading-none tracking-[0.2em] text-txt3",
    },
  };

  let s = $derived(sizes[size]);
</script>

<div class={s.container} aria-label="Tomte - Prompt Builder">
  <div class={s.icon}>
    <span class={s.iconText}>T</span>
    {#if size === "default"}
      <span
        class="absolute -bottom-1 -right-1 h-2 w-2 rounded-xs bg-amb"
        aria-hidden="true"
      ></span>
    {/if}
  </div>
  <div>
    <h1 class={s.title}>Tomte</h1>
    <p class={s.subtitle}>Prompt Builder</p>
  </div>
</div>