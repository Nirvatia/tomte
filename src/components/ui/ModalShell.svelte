<script lang="ts">
  import type { Snippet } from "svelte";

  /**
   * Каркас небольшой модалки: затемнение, закрытие по Escape и клику мимо,
   * возврат фокуса туда, где он был до открытия.
   */
  interface Props {
    label: string;
    onClose: () => void;
    width?: string;
    /** Отступ сверху: палитры команд обычно ближе к верху экрана. */
    placement?: "center" | "top";
    children: Snippet;
  }

  let {
    label,
    onClose,
    width = "max-w-lg",
    placement = "center",
    children,
  }: Props = $props();

  const previousFocus =
    typeof document !== "undefined"
      ? (document.activeElement as HTMLElement | null)
      : null;

  let dialog = $state<HTMLDivElement | null>(null);

  // Забираем фокус, если его не взял элемент внутри (например, поле с autofocus):
  // иначе Escape и Tab остались бы на странице под модалкой.
  $effect(() => {
    queueMicrotask(() => {
      if (dialog && !dialog.contains(document.activeElement)) dialog.focus();
    });
    return () => previousFocus?.focus?.();
  });

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onClose();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div
  bind:this={dialog}
  class="fixed inset-0 z-[90] flex animate-fade-in justify-center bg-black/60 p-4 backdrop-blur-[2px] {placement ===
  'top'
    ? 'items-start pt-[12vh]'
    : 'items-center'}"
  onclick={(event) => event.target === event.currentTarget && onClose()}
  onkeydown={() => {}}
  role="dialog"
  aria-modal="true"
  aria-label={label}
  tabindex="-1"
>
  <div
    class="w-full {width} animate-scale-in overflow-hidden rounded-xl border border-[var(--border-light)] bg-[var(--bg-dark)] shadow-[var(--shadow-lg)]"
  >
    {@render children()}
  </div>
</div>
