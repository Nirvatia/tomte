<script lang="ts">
  import type { Snippet } from "svelte";
  import { ChevronDown } from "@lucide/svelte";

  import { menu } from "$lib/actions/menu";

  /**
   * Кастомный dropdown (этап 8) — единственная замена нативного select
   * (язык, выбор модели). Триггер выглядит как поле, список — menu-panel,
   * клавиатура (стрелки, Home/End, Escape) — через use:menu.
   * Пункты внутри children: role="menuitem" | "menuitemcheckbox".
   */
  interface Props {
    /** aria-label триггера и меню. */
    label: string;
    trigger: Snippet;
    children: Snippet;
    /** Классы ширины выпадашки, например "w-56". */
    widthClass?: string;
    align?: "left" | "right";
    /** Растянуть триггер на ширину контейнера (панели). */
    fullWidth?: boolean;
    /** Дополнительные классы триггера (например, компактная высота). */
    triggerClass?: string;
  }

  let {
    label,
    trigger,
    children,
    widthClass = "min-w-40",
    align = "left",
    fullWidth = false,
    triggerClass = "",
  }: Props = $props();

  let open = $state(false);
  let triggerEl = $state<HTMLButtonElement | null>(null);
  let panelEl = $state<HTMLDivElement | null>(null);

  function close() {
    open = false;
  }

  function handleWindowPointerDown(event: PointerEvent) {
    if (
      open &&
      panelEl &&
      triggerEl &&
      !panelEl.contains(event.target as Node) &&
      !triggerEl.contains(event.target as Node)
    ) {
      close();
    }
  }
</script>

<svelte:window onpointerdown={handleWindowPointerDown} />

<div class="relative" class:w-full={fullWidth} class:w-fit={!fullWidth}>
  <button
    type="button"
    class="dropdown-trigger {triggerClass}"
    class:w-full={fullWidth}
    bind:this={triggerEl}
    aria-haspopup="menu"
    aria-expanded={open}
    aria-label={label}
    onclick={() => (open = !open)}
  >
    {@render trigger()}
    <ChevronDown size={14} class="chev" aria-hidden="true" />
  </button>

  {#if open}
    <div
      bind:this={panelEl}
      use:menu={{ onClose: close, returnFocus: triggerEl }}
      role="menu"
      aria-label={label}
      class="menu-panel absolute z-50 mt-1 {widthClass} {align === 'right'
        ? 'right-0'
        : 'left-0'} animate-fade-in"
    >
      {@render children()}
    </div>
  {/if}
</div>
