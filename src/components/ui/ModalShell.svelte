<script lang="ts" module>
  /**
   * Стек открытых модалок. Escape и Tab обрабатывает только верхняя:
   * иначе модалка поверх модалки (просмотр файла в менеджере файлов,
   * подтверждение в менеджере проектов) закрывала бы обе разом.
   */
  const stack: symbol[] = [];
</script>

<script lang="ts">
  import type { Snippet } from "svelte";
  import { onMount } from "svelte";

  /**
   * Каркас модалки (этап 13.1): затемнение, закрытие по Escape и клику
   * мимо, удержание фокуса по Tab, возврат фокуса туда, где он был до
   * открытия, и порядок слоёв, когда модалки открыты одна поверх другой.
   */
  interface Props {
    label: string;
    onClose: () => void;
    /**
     * Escape: по умолчанию закрывает. Модалка с вложенными состояниями
     * (переименование, создание) сначала выходит из них.
     */
    onEscape?: () => void;
    /** Ширина панели (класс Tailwind). */
    width?: string;
    /** Раскладка и высота панели: по умолчанию overflow-hidden. */
    panelClass?: string;
    /** Отступ сверху: палитры команд обычно ближе к верху экрана. */
    placement?: "center" | "top";
    /** alertdialog — для подтверждений: они над всеми модалками. */
    role?: "dialog" | "alertdialog";
    /** Клик по затемнению закрывает модалку. */
    closeOnBackdrop?: boolean;
    children: Snippet;
  }

  let {
    label,
    onClose,
    onEscape,
    width = "max-w-lg",
    panelClass = "overflow-hidden",
    placement = "center",
    role = "dialog",
    closeOnBackdrop = true,
    children,
  }: Props = $props();

  const FOCUSABLE =
    'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [contenteditable="true"], [tabindex]:not([tabindex="-1"])';

  const id = Symbol("modal");
  const depth = stack.length;
  const isTop = () => stack[stack.length - 1] === id;

  // Подтверждения всегда выше модалок, вложенные — выше родительских.
  const zIndex = $derived(
    `calc(var(${role === "alertdialog" ? "--layer-alert" : "--layer-modal"}) + ${depth})`,
  );

  const previousFocus =
    typeof document !== "undefined"
      ? (document.activeElement as HTMLElement | null)
      : null;

  let dialog = $state<HTMLDivElement | null>(null);

  onMount(() => {
    stack.push(id);
    // Забираем фокус, если его не взял элемент внутри (например, поле с
    // autofocus): иначе Escape и Tab остались бы на странице под модалкой.
    queueMicrotask(() => {
      if (dialog && !dialog.contains(document.activeElement)) dialog.focus();
    });
    return () => {
      const index = stack.indexOf(id);
      if (index >= 0) stack.splice(index, 1);
      previousFocus?.focus?.();
    };
  });

  function focusables(): HTMLElement[] {
    if (!dialog) return [];
    return Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (element) => element.getClientRects().length > 0,
    );
  }

  /** Tab ходит по кругу внутри модалки и не уходит на страницу под ней. */
  function trapTab(event: KeyboardEvent) {
    const items = focusables();
    if (items.length === 0) {
      event.preventDefault();
      dialog?.focus();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement as HTMLElement | null;
    const inside = Boolean(active && dialog?.contains(active));

    if (event.shiftKey && (!inside || active === first || active === dialog)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (!inside || active === last)) {
      event.preventDefault();
      first.focus();
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (!isTop()) return;
    if (event.key === "Escape") {
      // Меню и поля внутри модалки могли уже обработать Escape сами.
      if (event.defaultPrevented) return;
      event.preventDefault();
      event.stopPropagation();
      (onEscape ?? onClose)();
    } else if (event.key === "Tab") {
      trapTab(event);
    }
  }

  function handleBackdropClick(event: MouseEvent) {
    if (closeOnBackdrop && event.target === event.currentTarget) onClose();
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div
  bind:this={dialog}
  class="fixed inset-0 flex animate-fade-in justify-center bg-[var(--overlay)] p-4 backdrop-blur-[2px] {placement ===
  'top'
    ? 'items-start pt-[12vh]'
    : 'items-center'}"
  style="z-index: {zIndex}"
  onclick={handleBackdropClick}
  onkeydown={() => {}}
  {role}
  aria-modal="true"
  aria-label={label}
  tabindex="-1"
>
  <div
    class="w-full {width} {panelClass} animate-scale-in rounded-lg border border-[var(--border-light)] bg-[var(--bg-medium)] shadow-lg"
  >
    {@render children()}
  </div>
</div>
