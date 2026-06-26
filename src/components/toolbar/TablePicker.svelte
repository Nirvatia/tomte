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
      .insertTable({
        rows: row + 1,
        cols: col + 1,
        withHeaderRow: true,
      })
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
    onclick={toggle}
    class={BTN_BASE}
    class:active={editor?.isActive("table")}
    title="Вставить таблицу"
    aria-label="Вставить таблицу"
    aria-haspopup="dialog"
    aria-expanded={isOpen}
  >
    <Table size={18} />
  </button>

  {#if isOpen}
    <div
      role="dialog"
      aria-label="Выбор размера таблицы"
      class="absolute top-full left-0 mt-2 bg-surface rounded-xl shadow-xl border border-slate-100 p-3 animate-fade-in z-50"
    >
      <div
        class="text-xs font-semibold text-ink-tertiary uppercase tracking-wider mb-2 px-1"
      >
        Выберите размер
      </div>

      <div
        class="grid gap-0.5"
        style="grid-template-columns: repeat({GRID_SIZE}, 1fr);"
      >
        {#each Array(GRID_SIZE) as _, row}
          {#each Array(GRID_SIZE) as _, col}
            <button
              type="button"
              onmouseenter={() => handleCellHover(row, col)}
              onclick={() => handleCellClick(row, col)}
              class="w-5 h-5 rounded-sm border transition-all duration-75 {isHighlighted(
                row,
                col,
              )
                ? 'bg-brand-100 border-brand-400'
                : 'bg-surface-secondary border-slate-200 hover:border-brand-300'}"
              aria-label="Таблица {row + 1}×{col + 1}"
            >
            </button>
          {/each}
        {/each}
      </div>

      <div class="mt-2 text-center text-xs font-medium text-ink-secondary">
        {hoveredRow + 1} × {hoveredCol + 1}
      </div>
    </div>
  {/if}
</div>
