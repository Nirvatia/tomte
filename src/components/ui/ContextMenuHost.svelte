<script lang="ts">
  import { t } from "$lib/i18n";
  import { menu } from "$lib/actions/menu";
  import { closeContextMenu, contextMenu } from "../../stores/contextMenu";

  let menuElement = $state<HTMLDivElement | null>(null);
  let position = $state({ left: 0, top: 0 });

  // Не даём меню вылезти за край окна.
  $effect(() => {
    const state = $contextMenu;
    if (!state || !menuElement) return;
    const { width, height } = menuElement.getBoundingClientRect();
    position = {
      left: Math.max(4, Math.min(state.x, window.innerWidth - width - 4)),
      top: Math.max(4, Math.min(state.y, window.innerHeight - height - 4)),
    };
  });

  function select(onSelect: () => void) {
    const returnFocus = $contextMenu?.returnFocus;
    closeContextMenu();
    returnFocus?.focus();
    onSelect();
  }

  function handlePointerDown(event: PointerEvent) {
    if (
      $contextMenu &&
      menuElement &&
      !menuElement.contains(event.target as Node)
    ) {
      closeContextMenu();
    }
  }
</script>

<svelte:window
  onpointerdown={handlePointerDown}
  onresize={closeContextMenu}
  onblur={closeContextMenu}
/>

{#if $contextMenu}
  <div
    bind:this={menuElement}
    use:menu={{
      onClose: closeContextMenu,
      returnFocus: $contextMenu.returnFocus,
    }}
    role="menu"
    aria-label={$t("common.actions")}
    tabindex="-1"
    class="menu-panel fixed z-[var(--layer-context-menu)] min-w-52 animate-fade-in"
    style="left: {position.left}px; top: {position.top}px;"
  >
    {#each $contextMenu.items as item (item.label)}
      {#if item.separatorBefore}
        <div class="menu-sep" role="separator"></div>
      {/if}
      <button
        type="button"
        role="menuitem"
        disabled={item.disabled}
        onclick={() => select(item.onSelect)}
        class="menu-item justify-between gap-4 disabled:opacity-40"
        class:danger={item.danger}
      >
        <span>{item.label}</span>
        {#if item.hint}
          <span class="font-mono text-caption text-[var(--text-tertiary)]"
            >{item.hint}</span
          >
        {/if}
      </button>
    {/each}
  </div>
{/if}
