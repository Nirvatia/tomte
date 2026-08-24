<script lang="ts">
  import { Table } from "@lucide/svelte";
  import type { Editor } from "@tiptap/core";

  interface Props {
    editor?: Editor | null;
  }

  let { editor = null }: Props = $props();

  const GRID_SIZE = 8;
  let isOpen = $state(false);
  let hoveredRow = $state(0);
  let hoveredCol = $state(0);
  let container = $state<HTMLDivElement | null>(null);

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

  function handleKeydown(event: KeyboardEvent) {
    if (!isOpen) return;
    if (event.key === "Escape") {
      event.preventDefault();
      close();
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      hoveredRow = Math.min(hoveredRow + 1, GRID_SIZE - 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      hoveredRow = Math.max(hoveredRow - 1, 0);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      hoveredCol = Math.min(hoveredCol + 1, GRID_SIZE - 1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      hoveredCol = Math.max(hoveredCol - 1, 0);
    } else if (event.key === "Enter") {
      event.preventDefault();
      handleCellClick(hoveredRow, hoveredCol);
    }
  }

  function handleClickOutside(event: MouseEvent) {
    if (isOpen && container && !container.contains(event.target as Node)) {
      close();
    }
  }

  function isHighlighted(row: number, col: number): boolean {
    return row <= hoveredRow && col <= hoveredCol;
  }

  const BTN_BASE =
    "w-8 h-8 flex items-center justify-center rounded-[5px] text-[var(--text-secondary)] transition-all duration-150 hover:bg-[var(--bg-light)] hover:text-[var(--text-primary)] relative";
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
      class="absolute left-0 top-full z-50 mt-2 animate-fade-in rounded-[6px] border border-[var(--border-light)] bg-[var(--bg-medium)] p-3 shadow-[var(--shadow-md)]"
    >
      <div
        class="mb-2 px-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]"
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
              class="h-5 w-5 rounded-[3px] border transition-all duration-75 {isHighlighted(
                row,
                col,
              )
                ? 'border-[var(--accent-hover)] bg-[var(--accent-dim)]'
                : 'border-[var(--border)] bg-[var(--bg-darkest)] hover:border-[var(--accent)]'}"
              aria-label="Таблица {row + 1}×{col + 1}"
            ></button>
          {/each}
        {/each}
      </div>
      <div
        class="mt-2 text-center font-mono text-xs font-medium text-[var(--text-secondary)]"
      >
        {hoveredRow + 1} × {hoveredCol + 1}
      </div>
    </div>
  {/if}
</div>
