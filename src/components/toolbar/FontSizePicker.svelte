<script lang="ts">
  import { Type } from "@lucide/svelte";
  import type { Editor } from "@tiptap/core";

  let { editor = null }: { editor?: Editor | null } = $props();

  let isOpen = $state(false);
  let container: HTMLDivElement;

  const FONT_SIZES = [
    { label: "XS", value: "0.75rem" },
    { label: "SM", value: "0.875rem" },
    { label: "MD", value: "1rem" },
    { label: "LG", value: "1.125rem" },
    { label: "XL", value: "1.25rem" },
    { label: "2XL", value: "1.5rem" },
    { label: "3XL", value: "1.875rem" },
    { label: "4XL", value: "2.25rem" },
  ];

  let currentSize = $derived(() => {
    if (!editor) return null;
    const mark = editor.getAttributes("textStyle");
    return mark?.fontSize || null;
  });

  function toggle() {
    isOpen = !isOpen;
  }

  function setSize(size: string) {
    if (!editor) return;
    editor.chain().focus().setFontSize(size).run();
    isOpen = false;
  }

  function resetSize() {
    if (!editor) return;
    editor.chain().focus().unsetFontSize().run();
    isOpen = false;
  }

  function handleClickOutside(e: MouseEvent) {
    if (isOpen && container && !container.contains(e.target as Node)) {
      isOpen = false;
    }
  }

  const BTN_BASE =
    "p-2 rounded-lg text-ink-secondary transition-all duration-200 hover:bg-surface-tertiary hover:text-ink hover:-translate-y-0.5 hover:shadow-soft active:translate-y-0";
</script>

<svelte:window onclick={handleClickOutside} />

<div bind:this={container} class="relative">
  <button
    onclick={toggle}
    class={BTN_BASE}
    title="Размер шрифта"
    aria-label="Размер шрифта"
  >
    <Type size={18} />
  </button>

  {#if isOpen}
    <div
      role="dialog"
      aria-label="Выбор размера шрифта"
      class="absolute top-full left-0 mt-2 bg-surface rounded-xl shadow-xl border border-slate-100 p-2 animate-fade-in z-50 w-48"
    >
      <button
        onclick={resetSize}
        class="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface-tertiary transition-colors text-left"
      >
        <Type size={16} class="text-ink-tertiary" />
        <span class="text-sm text-ink-secondary">По умолчанию</span>
      </button>
      <div class="border-t border-slate-100 my-1"></div>
      {#each FONT_SIZES as size}
        <button
          onclick={() => setSize(size.value)}
          class="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface-tertiary transition-colors text-left {currentSize() ===
          size.value
            ? 'bg-brand-50'
            : ''}"
        >
          <span
            class="w-8 h-8 rounded bg-surface-secondary flex items-center justify-center text-xs font-mono text-ink-tertiary"
          >
            {size.label}
          </span>
          <span style="font-size: {size.value}" class="text-ink truncate">
            Пример текста
          </span>
        </button>
      {/each}
    </div>
  {/if}
</div>
