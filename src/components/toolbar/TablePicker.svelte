<script lang="ts">
  import { Table } from "@lucide/svelte";
  import type { Editor } from "@tiptap/core";
  let { editor = null }: { editor?: Editor | null } = $props();
  const GRID_SIZE = 8;
  let isOpen = $state(false);
  let hoveredRow = $state(0);
  let hoveredCol = $state(0);
  let container: HTMLDivElement;
  function toggle() {
    isOpen = !isOpen;
    if (isOpen) {
      hoveredRow = 0;
      hoveredCol = 0;
    }
  }
  function close() {
    isOpen = false;
  }
  function handleCellHover(row: number, col: number) {
    hoveredRow = row;
    hoveredCol = col;
  }
  function handleCellClick(row: number, col: number) {
    if (!editor) return;
    editor
      .chain()
      .focus()
      .insertTable({ rows: row + 1, cols: col + 1, withHeaderRow: true })
      .run();
    close();
  }
  function handleKeydown(e: KeyboardEvent) {
    if (!isOpen) return;
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      hoveredRow = Math.min(hoveredRow + 1, GRID_SIZE - 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      hoveredRow = Math.max(hoveredRow - 1, 0);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      hoveredCol = Math.min(hoveredCol + 1, GRID_SIZE - 1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      hoveredCol = Math.max(hoveredCol - 1, 0);
    } else if (e.key === "Enter") {
      e.preventDefault();
      handleCellClick(hoveredRow, hoveredCol);
    }
  }
  function handleClickOutside(e: MouseEvent) {
    if (isOpen && container && !container.contains(e.target as Node)) {
      close();
    }
  }
  function isHighlighted(row: number, col: number): boolean {
    return row <= hoveredRow && col <= hoveredCol;
  }
  const BTN_BASE =
    "p-2 rounded-lg text-ink-secondary transition-all duration-200 hover:bg-surface-tertiary hover:text-ink hover:-translate-y-0.5 hover:shadow-soft active:translate-y-0 relative";
</script>

<svelte:window onclick={handleClickOutside} onkeydown={handleKeydown} />

<div bind:this={container} class="relative">
  <button
    type="button"
    onclick={toggle}
    class="{BTN_BASE} {editor?.isActive('table') ? 'tb-active' : ''}"
    aria-label="Вставить таблицу"
    title="Вставить таблицу"
    aria-haspopup="dialog"
    aria-expanded={isOpen}
  >
    <Table size={18} />
  </button>

  {#if isOpen}
    <div
      role="dialog"
      aria-label="Выбор размера таблицы"
      class="absolute left-0 top-full z-50 mt-2 animate-fade-in rounded-lg border border-line2 bg-raised p-3 shadow-drop"
    >
      <div
        class="mb-2 px-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-txt3"
      >
        Выберите размер
      </div>
      <div
        class="grid gap-1"
        style="grid-template-columns: repeat({GRID_SIZE}, 1fr);"
      >
        {#each Array(GRID_SIZE) as _, row}
          {#each Array(GRID_SIZE) as _, col}
            <button
              type="button"
              onmouseenter={() => handleCellHover(row, col)}
              onclick={() => handleCellClick(row, col)}
              class="h-5 w-5 rounded-sm border transition-all duration-75 {isHighlighted(
                row,
                col,
              )
                ? 'border-brand-400 bg-brand-100'
                : 'border-line bg-inset hover:border-brand-300'}"
              aria-label="Таблица {row + 1}×{col + 1}"
            ></button>
          {/each}
        {/each}
      </div>
      <div class="mt-2 text-center font-mono text-xs font-medium text-txt2">
        {hoveredRow + 1} × {hoveredCol + 1}
      </div>
    </div>
  {/if}
</div>