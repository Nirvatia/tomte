<script lang="ts">
  import { Type } from "@lucide/svelte";
  import type { Editor } from "@tiptap/core";

  interface Props {
    editor?: Editor | null;
  }

  let { editor = null }: Props = $props();

  let isOpen = $state(false);
  let container = $state<HTMLDivElement | null>(null);

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

  const currentSize = $derived.by(() => {
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

  function handleClickOutside(event: MouseEvent) {
    if (isOpen && container && !container.contains(event.target as Node)) {
      isOpen = false;
    }
  }

  const BTN_BASE =
    "w-8 h-8 flex items-center justify-center rounded-[5px] text-[var(--text-secondary)] transition-all duration-150 hover:bg-[var(--bg-light)] hover:text-[var(--text-primary)]";
</script>

<svelte:window onclick={handleClickOutside} />

<div bind:this={container} class="relative">
  <button
    type="button"
    onclick={toggle}
    class={BTN_BASE}
    aria-label="Размер шрифта"
    title="Размер шрифта"
  >
    <Type size={18} />
  </button>
  {#if isOpen}
    <div
      role="dialog"
      aria-label="Выбор размера шрифта"
      class="absolute left-0 top-full z-50 mt-2 w-56 animate-fade-in rounded-[6px] border border-[var(--border-light)] bg-[var(--bg-medium)] p-1.5 shadow-[var(--shadow-md)]"
    >
      <button
        type="button"
        onclick={resetSize}
        class="flex w-full items-center gap-3 rounded-[5px] px-3 py-2 text-left transition-colors hover:bg-[var(--bg-lighter)]"
      >
        <Type size={16} class="shrink-0 text-[var(--text-tertiary)]" />
        <span class="text-[13px] text-[var(--text-secondary)]"
          >По умолчанию</span
        >
      </button>
      <div class="mx-1 my-1 h-px bg-[var(--border)]"></div>
      {#each FONT_SIZES as size}
        <button
          type="button"
          onclick={() => setSize(size.value)}
          class="flex w-full items-center gap-3 rounded-[5px] px-3 py-2 text-left transition-colors hover:bg-[var(--bg-lighter)] {currentSize ===
          size.value
            ? 'bg-[var(--accent-dim)]'
            : ''}"
        >
          <span
            class="flex h-8 w-8 shrink-0 items-center justify-center rounded-[4px] border border-[var(--border)] bg-[var(--bg-darkest)] font-mono text-[10px] text-[var(--text-tertiary)]"
          >
            {size.label}
          </span>
          <span
            style="font-size: {size.value}"
            class="truncate text-[var(--text-primary)]"
          >
            Пример текста
          </span>
        </button>
      {/each}
    </div>
  {/if}
</div>
