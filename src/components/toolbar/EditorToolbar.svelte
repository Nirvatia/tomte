<script lang="ts">
  import { t } from "$lib/i18n";
  import {
    Bold,
    Code,
    Copy,
    Eraser,
    FolderTree,
    Heading1,
    Heading2,
    Highlighter,
    Italic,
    List,
    ListIndentDecrease,
    ListIndentIncrease,
    ListOrdered,
    Quote,
    Redo2,
    Strikethrough,
    Trash2,
    Underline as UnderlineIcon,
    Undo2,
  } from "@lucide/svelte";
  import type { ChainedCommands, Editor } from "@tiptap/core";

  import { isProjectTreeOpen } from "../../stores";
  import {
    EMPTY_TOOLBAR_STATE,
    confirmClearProject,
    confirmClearText,
    copyEditorText,
    readToolbarState,
  } from "./editorCommands";
  import FontSizePicker from "./FontSizePicker.svelte";
  import TablePicker from "./TablePicker.svelte";
  import TableActionsMenu from "./TableActionsMenu.svelte";
  import ToolbarButton from "./ToolbarButton.svelte";

  /**
   * Тулбар редактора. Группы прячутся по ширине контейнера (@container):
   * @2xl — зачёркнутый/выделение/код, @3xl — списки и цитата, @4xl —
   * заголовки и размер шрифта. Копировать и очистить видны всегда: меню
   * «Инструменты» убрано, прятать эти кнопки больше некуда. Предпросмотр
   * живёт в шапке, экстрактор — в боковой панели.
   * Команды — editorCommands.ts, меню таблицы — TableActionsMenu.
   */
  interface Props {
    editor?: Editor | null;
  }

  let { editor = null }: Props = $props();

  let state = $state(EMPTY_TOOLBAR_STATE);

  $effect(() => {
    if (!editor) return;
    const current = editor;
    const update = () => (state = readToolbarState(current));
    update();
    current.on("update", update);
    current.on("selectionUpdate", update);
    current.on("transaction", update);
    return () => {
      current.off("update", update);
      current.off("selectionUpdate", update);
      current.off("transaction", update);
    };
  });

  const isOn = (key: string) => state.active.has(key);

  /** Команда редактора с возвратом фокуса в текст. */
  function run(command: (chain: ChainedCommands) => ChainedCommands) {
    if (editor) command(editor.chain().focus()).run();
  }
</script>

<!-- @container: группы и подписи прячутся, когда тулбару не хватает ширины. -->
<div
  data-tour="toolbar"
  class="@container flex h-[44px] shrink-0 items-center gap-1 border-b border-[var(--border)] bg-[var(--bg-medium)] px-4"
>
  <button
    type="button"
    onclick={() => isProjectTreeOpen.update((open) => !open)}
    class="flex h-8 w-8 items-center justify-center rounded-md transition-all duration-150 {$isProjectTreeOpen
      ? 'bg-[var(--accent-dim)] text-[var(--accent)]'
      : 'text-[var(--text-tertiary)] hover:bg-[var(--bg-light)] hover:text-[var(--text-primary)]'}"
    aria-label={$t("toolbar.openTree")}
    aria-pressed={$isProjectTreeOpen}
    title={$t("toolbar.treeTitle")}
  >
    <FolderTree size={18} />
  </button>

  <div class="mx-1.5 h-6 w-px shrink-0 bg-[var(--border)]"></div>
  <div class="flex items-center gap-0.5">
    <ToolbarButton
      label={$t("common.undo")}
      hint={$t("toolbar.undoHint")}
      disabled={!state.canUndo}
      onclick={() => run((c) => c.undo())}
    >
      <Undo2 size={18} />
    </ToolbarButton>
    <ToolbarButton
      label={$t("common.redo")}
      hint={$t("toolbar.redoHint")}
      disabled={!state.canRedo}
      onclick={() => run((c) => c.redo())}
    >
      <Redo2 size={18} />
    </ToolbarButton>
  </div>

  <div
    class="mx-1.5 hidden h-6 w-px shrink-0 bg-[var(--border)] @4xl:block"
  ></div>
  <div class="hidden items-center gap-0.5 @4xl:flex">
    <ToolbarButton
      label={$t("toolbar.h1")}
      active={isOn("h1")}
      onclick={() => run((c) => c.toggleHeading({ level: 1 }))}
    >
      <Heading1 size={18} />
    </ToolbarButton>
    <ToolbarButton
      label={$t("toolbar.h2")}
      active={isOn("h2")}
      onclick={() => run((c) => c.toggleHeading({ level: 2 }))}
    >
      <Heading2 size={18} />
    </ToolbarButton>
  </div>
  <div
    class="mx-1.5 hidden h-6 w-px shrink-0 bg-[var(--border)] @4xl:block"
  ></div>
  <div class="hidden items-center @4xl:flex">
    <FontSizePicker {editor} />
  </div>

  <div class="mx-1.5 h-6 w-px shrink-0 bg-[var(--border)]"></div>
  <div class="flex items-center gap-0.5">
    <ToolbarButton
      label={$t("toolbar.bold")}
      hint={$t("toolbar.boldHint")}
      active={isOn("bold")}
      onclick={() => run((c) => c.toggleBold())}
    >
      <Bold size={18} />
    </ToolbarButton>
    <ToolbarButton
      label={$t("toolbar.italic")}
      hint={$t("toolbar.italicHint")}
      active={isOn("italic")}
      onclick={() => run((c) => c.toggleItalic())}
    >
      <Italic size={18} />
    </ToolbarButton>
    <ToolbarButton
      label={$t("toolbar.underline")}
      hint={$t("toolbar.underlineHint")}
      active={isOn("underline")}
      onclick={() => run((c) => c.toggleUnderline())}
    >
      <UnderlineIcon size={18} />
    </ToolbarButton>
    <ToolbarButton
      label={$t("toolbar.strike")}
      active={isOn("strike")}
      class="hidden @2xl:flex"
      onclick={() => run((c) => c.toggleStrike())}
    >
      <Strikethrough size={18} />
    </ToolbarButton>
    <ToolbarButton
      label={$t("toolbar.highlight")}
      active={isOn("highlight")}
      class="hidden @2xl:flex"
      onclick={() => run((c) => c.toggleHighlight())}
    >
      <Highlighter size={18} />
    </ToolbarButton>
    <ToolbarButton
      label={$t("toolbar.code")}
      active={isOn("code")}
      class="hidden @2xl:flex"
      onclick={() => run((c) => c.toggleCode())}
    >
      <Code size={18} />
    </ToolbarButton>
  </div>

  <div
    class="mx-1.5 hidden h-6 w-px shrink-0 bg-[var(--border)] @3xl:block"
  ></div>
  <div class="hidden items-center gap-0.5 @3xl:flex">
    <ToolbarButton
      label={$t("toolbar.bulletList")}
      active={isOn("bulletList")}
      onclick={() => run((c) => c.toggleBulletList())}
    >
      <List size={18} />
    </ToolbarButton>
    <ToolbarButton
      label={$t("toolbar.orderedList")}
      active={isOn("orderedList")}
      onclick={() => run((c) => c.toggleOrderedList())}
    >
      <ListOrdered size={18} />
    </ToolbarButton>
    <ToolbarButton
      label={$t("toolbar.outdent")}
      onclick={() => run((c) => c.liftListItem("listItem"))}
    >
      <ListIndentDecrease size={18} />
    </ToolbarButton>
    <ToolbarButton
      label={$t("toolbar.indent")}
      onclick={() => run((c) => c.sinkListItem("listItem"))}
    >
      <ListIndentIncrease size={18} />
    </ToolbarButton>
    <ToolbarButton
      label={$t("toolbar.quote")}
      active={isOn("blockquote")}
      onclick={() => run((c) => c.toggleBlockquote())}
    >
      <Quote size={18} />
    </ToolbarButton>
    <TablePicker {editor} />
  </div>

  {#if state.isInsideTable}
    <div class="mx-1.5 h-6 w-px shrink-0 bg-[var(--border)]"></div>
    <div class="shrink-0 animate-fade-in">
      <TableActionsMenu {editor} />
    </div>
  {/if}

  <!-- Копировать/очистить видны на любой ширине. В таблице на самой узкой
       ширине они уступают место кнопке действий с таблицей. -->
  <div
    class="mx-1.5 h-6 w-px shrink-0 bg-[var(--border)] {state.isInsideTable
      ? 'hidden @2xl:block'
      : ''}"
  ></div>
  <div
    class="items-center gap-0.5 {state.isInsideTable
      ? 'hidden @2xl:flex'
      : 'flex'}"
  >
    <ToolbarButton
      label={$t("toolbar.copyText")}
      onclick={() => copyEditorText(editor)}
    >
      <Copy size={18} />
    </ToolbarButton>
    <ToolbarButton
      label={$t("toolbar.clearText.button")}
      class="hover:bg-[var(--error)]/10"
      onclick={() => void confirmClearText(editor)}
    >
      <Trash2 size={18} class="text-[var(--error)]" />
    </ToolbarButton>
    <ToolbarButton
      label={$t("toolbar.clearProject.button")}
      hint={$t("toolbar.clearProject.hint")}
      class="hover:bg-[var(--accent-dim)]"
      onclick={() => void confirmClearProject(editor)}
    >
      <Eraser size={18} class="text-[var(--warning)]" />
    </ToolbarButton>
  </div>
</div>
