<script lang="ts">
  import logo from "$lib/assets/logo.png";

  interface Props {
    size?: "default" | "compact";
  }

  let { size = "default" }: Props = $props();

  const sizes = {
    default: {
      container: "flex select-none items-center gap-3",
      icon: "relative grid h-10 w-10 place-items-center rounded-[10px] bg-[var(--accent)]",
      iconImg: "h-6 w-6 object-contain",
      title:
        "text-[17px] font-extrabold leading-none tracking-tight text-[var(--text-primary)]",
      subtitle:
        "mt-1 font-mono text-[10px] font-semibold uppercase leading-none tracking-[0.1em] text-[var(--text-secondary)]",
    },
    compact: {
      container: "flex select-none items-center gap-2.5",
      icon: "relative grid h-8 w-8 place-items-center rounded-lg bg-[var(--accent)]",
      iconImg: "h-5 w-5 object-contain",
      title:
        "text-[15px] font-extrabold leading-none tracking-tight text-[var(--text-primary)]",
      subtitle:
        "mt-0.5 font-mono text-[10px] font-semibold uppercase leading-none tracking-[0.1em] text-[var(--text-secondary)]",
    },
  };

  const currentSize = $derived(sizes[size]);
</script>

<div class={currentSize.container} aria-label="Tomte - Prompt Builder">
  <div class={currentSize.icon}>
    <img src={logo} alt="Tomte" class={currentSize.iconImg} />
    {#if size === "default"}
      <span
        class="absolute -bottom-1 -right-1 h-2 w-2 rounded-xs bg-[var(--accent)]"
        aria-hidden="true"
      ></span>
    {/if}
  </div>
  <div>
    <h1 class={currentSize.title}>Tomte</h1>
    <p class={currentSize.subtitle}>Prompt Builder</p>
  </div>
</div>
