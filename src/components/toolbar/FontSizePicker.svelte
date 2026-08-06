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
      class="absolute left-0 top-full z-50 mt-2 w-56 animate-fade-in rounded-lg border border-line2 bg-raised p-1.5 shadow-drop"
    >
      <button
        type="button"
        onclick={resetSize}
        class="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors hover:bg-raised2"
      >
        <Type size={16} class="shrink-0 text-txt3" />
        <span class="text-[13px] text-txt2">По умолчанию</span>
      </button>

      <div class="mx-1 my-1 h-px bg-line"></div>

      {#each FONT_SIZES as size}
        <button
          type="button"
          onclick={() => setSize(size.value)}
          class="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors hover:bg-raised2 {currentSize() ===
          size.value
            ? 'bg-brand-50'
            : ''}"
        >
          <span
            class="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-line bg-inset font-mono text-[10px] text-txt3"
          >
            {size.label}
          </span>
          <span style="font-size: {size.value}" class="truncate text-txt">
            Пример текста
          </span>
        </button>
      {/each}
    </div>
  {/if}
</div>