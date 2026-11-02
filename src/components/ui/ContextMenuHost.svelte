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
    class="fixed z-[95] min-w-52 animate-fade-in rounded-[6px] border border-[var(--border-light)] bg-[var(--bg-medium)] p-1 shadow-[var(--shadow-md)]"
    style="left: {position.left}px; top: {position.top}px;"
  >
    {#each $contextMenu.items as item (item.label)}
      {#if item.separatorBefore}
        <div class="mx-1 my-1 h-px bg-[var(--border)]" role="separator"></div>
      {/if}
      <button
        type="button"
        role="menuitem"
        disabled={item.disabled}
        onclick={() => select(item.onSelect)}
        class="flex w-full items-center justify-between gap-4 rounded px-2.5 py-1.5 text-left text-[13px] outline-none disabled:opacity-40 {item.danger
          ? 'text-[var(--error)] hover:bg-[var(--error)]/10 focus:bg-[var(--error)]/10'
          : 'text-[var(--text-secondary)] hover:bg-[var(--bg-lighter)] hover:text-[var(--text-primary)] focus:bg-[var(--bg-lighter)] focus:text-[var(--text-primary)]'}"
      >
        <span>{item.label}</span>
        {#if item.hint}
          <span class="font-mono text-[11px] text-[var(--text-tertiary)]"
            >{item.hint}</span
          >
        {/if}
      </button>
    {/each}
  </div>
{/if}
