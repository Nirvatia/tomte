<script lang="ts">
  let { size = "default" }: { size?: "default" | "compact" } = $props();

  const sizes = {
    default: {
      container: "flex items-center gap-3",
      icon: "w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center shadow-glow",
      iconText: "text-white text-xl font-black",
      title: "text-xl font-bold text-ink tracking-tight",
      subtitle:
        "text-[10px] text-ink-tertiary font-medium uppercase tracking-widest -mt-0.5",
    },
    compact: {
      container: "flex items-center gap-2",
      icon: "w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center",
      iconText: "text-white text-sm font-black",
      title: "text-base font-bold text-ink tracking-tight",
      subtitle:
        "text-[9px] text-ink-tertiary font-medium uppercase tracking-widest -mt-0.5",
    },
  };

  let s = $derived(sizes[size]);
</script>

<div class={s.container}>
  <div class={s.icon}>
    <span class={s.iconText}>T</span>
  </div>
  <div class="text-left">
    <h1 class={s.title}>Tomte</h1>
    <p class={s.subtitle}>Prompt Builder</p>
  </div>
</div>
