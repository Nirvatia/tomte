<script lang="ts">
  import { t } from "$lib/i18n";
  import {
    Brain,
    Copy,
    Eraser,
    Eye,
    FlaskConical,
    GraduationCap,
    Trash2,
    Wrench,
  } from "@lucide/svelte";
  import type { Editor } from "@tiptap/core";

  import { menu } from "$lib/actions/menu";
  import { isExtractorOpen, isPreviewOpen, isTourOpen } from "../../stores";
  import { applyTestData } from "../../utils/testData";
  import {
    confirmClearProject,
    confirmClearText,
    copyEditorText,
  } from "./editorCommands";

  /**
   * Меню «Инструменты» тулбара (этап 15.2). Копировать и очистить здесь —
   * только пока их группы нет в самом тулбаре (narrowOnly: те же пороги
   * ширины, что у группы).
   */
  interface Props {
    editor: Editor | null;
    narrowOnly: string;
  }

  let { editor, narrowOnly }: Props = $props();

  let isOpen = $state(false);
  let container = $state<HTMLDivElement | null>(null);
  let trigger = $state<HTMLButtonElement | null>(null);

  function toggle(event: MouseEvent) {
    event.stopPropagation();
    isOpen = !isOpen;
  }

  function handleClickOutside(event: MouseEvent) {
    if (isOpen && container && !container.contains(event.target as Node)) {
      isOpen = false;
    }
  }

  /** Пункт меню: закрыть меню и выполнить действие. */
  function pick(action: () => void) {
    return () => {
      isOpen = false;
      action();
    };
  }

  const TRIGGER_CLASS =
    "flex items-center gap-2 px-3.5 py-[7px] rounded-md border border-[var(--border)] text-[var(--text-secondary)] text-ui font-medium transition-all duration-150 hover:bg-[var(--bg-light)] hover:text-[var(--text-primary)] hover:border-[var(--border-light)]";
</script>

<svelte:window onclick={handleClickOutside} />

<div bind:this={container} class="relative">
  <button
    bind:this={trigger}
    type="button"
    onclick={toggle}
    class="{TRIGGER_CLASS} {isOpen
      ? 'border-[var(--accent)] text-[var(--accent)]'
      : ''}"
    aria-haspopup="menu"
    aria-expanded={isOpen}
    aria-label={$t("toolbar.toolsOpen")}
    title={$t("toolbar.tools")}
  >
    <Wrench size={14} />
    <span class="hidden @5xl:inline">{$t("toolbar.tools")}</span>
  </button>
  {#if isOpen}
    <div
      use:menu={{ onClose: () => (isOpen = false), returnFocus: trigger }}
      role="menu"
      aria-label={$t("toolbar.toolsMenu")}
      class="menu-panel absolute right-0 top-full z-[var(--layer-dropdown)] mt-2 w-64 animate-fade-in"
    >
      <button
        type="button"
        role="menuitem"
        onclick={pick(() => isPreviewOpen.set(true))}
        class="menu-item"
      >
        <Eye size={14} class="shrink-0" />
        <span class="flex-1">{$t("toolbar.preview")}</span>
      </button>
      <button
        type="button"
        role="menuitem"
        class="menu-item {narrowOnly}"
        onclick={pick(() => copyEditorText(editor))}
      >
        <Copy size={14} class="shrink-0" />
        <span class="flex-1">{$t("toolbar.copyText")}</span>
      </button>
      <button
        type="button"
        role="menuitem"
        class="menu-item danger {narrowOnly}"
        onclick={pick(() => void confirmClearText(editor))}
      >
        <Trash2 size={14} class="shrink-0" />
        <span class="flex-1">{$t("toolbar.clearText.button")}</span>
      </button>
      <button
        type="button"
        role="menuitem"
        class="menu-item {narrowOnly}"
        onclick={pick(() => void confirmClearProject(editor))}
      >
        <Eraser size={14} class="shrink-0 text-[var(--warning)]" />
        <span class="flex-1">{$t("toolbar.clearProject.button")}</span>
      </button>
      <button
        type="button"
        role="menuitem"
        onclick={pick(() => isExtractorOpen.set(true))}
        class="menu-item"
      >
        <Brain size={14} class="shrink-0" />
        <span class="flex-1">{$t("toolbar.extractor")}</span>
      </button>
      <button
        type="button"
        role="menuitem"
        onclick={pick(() => isTourOpen.set(true))}
        class="menu-item"
      >
        <GraduationCap size={14} class="shrink-0" />
        <span class="flex-1">{$t("toolbar.tour")}</span>
      </button>
      <div class="menu-sep"></div>
      <button
        type="button"
        role="menuitem"
        onclick={pick(() => applyTestData(editor))}
        class="menu-item"
      >
        <FlaskConical size={14} class="shrink-0" />
        <span class="flex-1">{$t("toolbar.testData")}</span>
      </button>
    </div>
  {/if}
</div>
