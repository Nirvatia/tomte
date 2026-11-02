<script lang="ts">
  import { t } from "$lib/i18n";
  import {
    Undo2,
    Redo2,
    Copy,
    Trash2,
    List,
    ListOrdered,
    ListIndentIncrease,
    ListIndentDecrease,
    Eye,
    Brain,
    Bold,
    Italic,
    Underline as UnderlineIcon,
    Code,
    Quote,
    Heading1,
    Heading2,
    Strikethrough,
    Highlighter,
    Rows3,
    Columns3,
    Minus,
    Trash,
    Eraser,
    FolderTree,
    Wrench,
    FlaskConical,
  } from "@lucide/svelte";

  import type { Editor } from "@tiptap/core";

  import {
    isPreviewOpen,
    isExtractorOpen,
    exportFormat,
    isProjectTreeOpen,
  } from "../../stores";

  import { requestConfirm } from "../../stores/confirm";

  import {
    clearAttachmentsFromProject,
    clearProjectTreeSource,
    clearActiveFileContent,
  } from "../../utils/projectActions";

  import { applyTestData } from "../../utils/testData";

  import FontSizePicker from "./FontSizePicker.svelte";
  import TablePicker from "./TablePicker.svelte";

  interface Props {
    editor?: Editor | null;
  }

  let { editor = null }: Props = $props();

  let isToolsMenuOpen = $state(false);
  let toolsMenuContainer = $state<HTMLDivElement | null>(null);

  function toggleToolsMenu(event: MouseEvent) {
    event.stopPropagation();
    isToolsMenuOpen = !isToolsMenuOpen;
  }

  function handleClickOutside(event: MouseEvent) {
    if (
      isToolsMenuOpen &&
      toolsMenuContainer &&
      !toolsMenuContainer.contains(event.target as Node)
    ) {
      isToolsMenuOpen = false;
    }
  }

  function toggleProjectTree() {
    isProjectTreeOpen.update((v) => !v);
  }

  let toolbarState = $state({
    canUndo: false,
    canRedo: false,
    activeMarks: new Set<string>(),
    activeBlocks: new Set<string>(),
    isInsideTable: false,
  });

  function updateToolbarState() {
    if (!editor) return;
    const marks = new Set<string>();
    const blocks = new Set<string>();
    if (editor.isActive("bold")) marks.add("bold");
    if (editor.isActive("italic")) marks.add("italic");
    if (editor.isActive("underline")) marks.add("underline");
    if (editor.isActive("strike")) marks.add("strike");
    if (editor.isActive("highlight")) marks.add("highlight");
    if (editor.isActive("code")) marks.add("code");
    if (editor.isActive("heading", { level: 1 })) blocks.add("h1");
    if (editor.isActive("heading", { level: 2 })) blocks.add("h2");
    if (editor.isActive("bulletList")) blocks.add("bulletList");
    if (editor.isActive("orderedList")) blocks.add("orderedList");
    if (editor.isActive("blockquote")) blocks.add("blockquote");
    if (editor.isActive("table")) blocks.add("table");
    toolbarState = {
      canUndo: editor.can().undo(),
      canRedo: editor.can().redo(),
      activeMarks: marks,
      activeBlocks: blocks,
      isInsideTable: editor.isActive("table"),
    };
  }

  $effect(() => {
    if (!editor) return;
    updateToolbarState();
    editor.on("update", updateToolbarState);
    editor.on("selectionUpdate", updateToolbarState);
    editor.on("transaction", updateToolbarState);
    return () => {
      editor?.off("update", updateToolbarState);
      editor?.off("selectionUpdate", updateToolbarState);
      editor?.off("transaction", updateToolbarState);
    };
  });

  async function handleClearDraft() {
    const confirmed = await requestConfirm({
      title: $t("toolbar.clearProject.title"),
      message: $t("toolbar.clearProject.message"),
      confirmText: $t("common.clear"),
      cancelText: $t("common.cancel"),
      danger: true,
    });
    if (!confirmed) return;
    await clearActiveFileContent();
    editor?.commands.clearContent();
    await clearAttachmentsFromProject();
    await clearProjectTreeSource();
    exportFormat.set("pdf");
  }

  function isActive(mark: string): boolean {
    return toolbarState.activeMarks.has(mark);
  }

  function isBlockActive(block: string): boolean {
    return toolbarState.activeBlocks.has(block);
  }

  function btnClass(active: boolean): string {
    return `${TOOLBAR_BTN_BASE} ${active ? TOOLBAR_BTN_ACTIVE : TOOLBAR_BTN_IDLE}`;
  }

  function run(cmd: () => void) {
    if (!editor) return;
    editor.chain().focus();
    cmd();
  }

  function handleCopy() {
    if (!editor) return;
    navigator.clipboard.writeText(editor.getText());
  }

  async function handleClear() {
    if (!editor) return;
    const confirmed = await requestConfirm({
      title: $t("toolbar.clearText.title"),
      message: $t("toolbar.clearText.message"),
      confirmText: $t("common.clear"),
      cancelText: $t("common.cancel"),
      danger: true,
    });
    if (!confirmed) return;
    editor.commands.clearContent();
  }

  function handleApplyTestData() {
    applyTestData(editor);
  }

  function addRowBefore() {
    run(() => editor?.chain().focus().addRowBefore().run());
  }

  function addRowAfter() {
    run(() => editor?.chain().focus().addRowAfter().run());
  }

  function addColumnBefore() {
    run(() => editor?.chain().focus().addColumnBefore().run());
  }

  function addColumnAfter() {
    run(() => editor?.chain().focus().addColumnAfter().run());
  }

  function deleteRow() {
    run(() => editor?.chain().focus().deleteRow().run());
  }

  function deleteColumn() {
    run(() => editor?.chain().focus().deleteColumn().run());
  }

  async function deleteTable() {
    if (!editor) return;
    const confirmed = await requestConfirm({
      title: $t("toolbar.deleteTable.title"),
      message: $t("toolbar.deleteTable.message"),
      confirmText: $t("common.delete"),
      cancelText: $t("common.cancel"),
      danger: true,
    });
    if (!confirmed) return;
    editor.chain().focus().deleteTable().run();
  }

  // Цвета состояний не смешиваем в одной строке классов: из двух text-[...]
  // Tailwind применяет тот, что позже в CSS, а не в атрибуте. Из-за этого
  // активная кнопка раньше получала светлую иконку на бирюзовом (1.3:1).
  const TOOLBAR_BTN_BASE =
    "w-8 h-8 flex items-center justify-center rounded-[5px] transition-all duration-150 disabled:opacity-30 disabled:cursor-not-allowed";
  const TOOLBAR_BTN_IDLE =
    "text-[var(--text-secondary)] hover:bg-[var(--bg-light)] hover:text-[var(--text-primary)]";
  const TOOLBAR_BTN_ACTIVE =
    "bg-[var(--accent)] text-[var(--bg-darkest)] hover:bg-[var(--accent-hover)]";
  const ACTION_BTN_BASE =
    "flex items-center gap-2 px-3.5 py-[7px] rounded-[5px] border border-[var(--border)] text-[var(--text-secondary)] text-[13px] font-medium transition-all duration-150 hover:bg-[var(--bg-light)] hover:text-[var(--text-primary)] hover:border-[var(--border-light)]";
  const MENU_ITEM_BASE =
    "flex w-full items-center gap-2.5 rounded-[5px] px-3 py-2 text-left text-[13px] font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-lighter)] hover:text-[var(--text-primary)]";
</script>

<svelte:window onclick={handleClickOutside} />

<div
  class="flex h-[44px] shrink-0 items-center gap-1 border-b border-[var(--border)] bg-[var(--bg-medium)] px-4"
>
  <button
    type="button"
    onclick={toggleProjectTree}
    class="w-8 h-8 flex items-center justify-center rounded-[5px] transition-all duration-150 {$isProjectTreeOpen
      ? 'bg-[var(--accent-dim)] text-[var(--accent)]'
      : 'text-[var(--text-tertiary)] hover:bg-[var(--bg-light)] hover:text-[var(--text-primary)]'}"
    aria-label={$t("toolbar.openTree")}
    title={$t("toolbar.treeTitle")}
  >
    <FolderTree size={18} />
  </button>
  <div class="mx-1.5 h-6 w-px shrink-0 bg-[var(--border)]"></div>
  <div class="flex items-center gap-0.5">
    <button
      type="button"
      onclick={() => run(() => editor?.chain().focus().undo().run())}
      disabled={!toolbarState.canUndo}
      class={btnClass(false)}
      aria-label={$t("common.undo")}
      title={$t("toolbar.undoHint")}
    >
      <Undo2 size={18} />
    </button>
    <button
      type="button"
      onclick={() => run(() => editor?.chain().focus().redo().run())}
      disabled={!toolbarState.canRedo}
      class={btnClass(false)}
      aria-label={$t("common.redo")}
      title={$t("toolbar.redoHint")}
    >
      <Redo2 size={18} />
    </button>
  </div>
  <div class="mx-1.5 h-6 w-px shrink-0 bg-[var(--border)]"></div>
  <div class="flex items-center gap-0.5">
    <button
      type="button"
      onclick={() =>
        run(() => editor?.chain().focus().toggleHeading({ level: 1 }).run())}
      class={btnClass(isBlockActive("h1"))}
      aria-label={$t("toolbar.h1")}
      title={$t("toolbar.h1")}
    >
      <Heading1 size={18} />
    </button>
    <button
      type="button"
      onclick={() =>
        run(() => editor?.chain().focus().toggleHeading({ level: 2 }).run())}
      class={btnClass(isBlockActive("h2"))}
      aria-label={$t("toolbar.h2")}
      title={$t("toolbar.h2")}
    >
      <Heading2 size={18} />
    </button>
  </div>
  <div class="mx-1.5 h-6 w-px shrink-0 bg-[var(--border)]"></div>
  <div class="flex items-center">
    <FontSizePicker {editor} />
  </div>
  <div class="mx-1.5 h-6 w-px shrink-0 bg-[var(--border)]"></div>
  <div class="flex items-center gap-0.5">
    <button
      type="button"
      onclick={() => run(() => editor?.chain().focus().toggleBold().run())}
      class={btnClass(isActive("bold"))}
      aria-label={$t("toolbar.bold")}
      title={$t("toolbar.boldHint")}
    >
      <Bold size={18} />
    </button>
    <button
      type="button"
      onclick={() => run(() => editor?.chain().focus().toggleItalic().run())}
      class={btnClass(isActive("italic"))}
      aria-label={$t("toolbar.italic")}
      title={$t("toolbar.italicHint")}
    >
      <Italic size={18} />
    </button>
    <button
      type="button"
      onclick={() => run(() => editor?.chain().focus().toggleUnderline().run())}
      class={btnClass(isActive("underline"))}
      aria-label={$t("toolbar.underline")}
      title={$t("toolbar.underlineHint")}
    >
      <UnderlineIcon size={18} />
    </button>
    <button
      type="button"
      onclick={() => run(() => editor?.chain().focus().toggleStrike().run())}
      class={btnClass(isActive("strike"))}
      aria-label={$t("toolbar.strike")}
      title={$t("toolbar.strike")}
    >
      <Strikethrough size={18} />
    </button>
    <button
      type="button"
      onclick={() => run(() => editor?.chain().focus().toggleHighlight().run())}
      class={btnClass(isActive("highlight"))}
      aria-label={$t("toolbar.highlight")}
      title={$t("toolbar.highlight")}
    >
      <Highlighter size={18} />
    </button>
    <button
      type="button"
      onclick={() => run(() => editor?.chain().focus().toggleCode().run())}
      class={btnClass(isActive("code"))}
      aria-label={$t("toolbar.code")}
      title={$t("toolbar.code")}
    >
      <Code size={18} />
    </button>
  </div>
  <div class="mx-1.5 h-6 w-px shrink-0 bg-[var(--border)]"></div>
  <div class="flex items-center gap-0.5">
    <button
      type="button"
      onclick={() =>
        run(() => editor?.chain().focus().toggleBulletList().run())}
      class={btnClass(isBlockActive("bulletList"))}
      aria-label={$t("toolbar.bulletList")}
      title={$t("toolbar.bulletList")}
    >
      <List size={18} />
    </button>
    <button
      type="button"
      onclick={() =>
        run(() => editor?.chain().focus().toggleOrderedList().run())}
      class={btnClass(isBlockActive("orderedList"))}
      aria-label={$t("toolbar.orderedList")}
      title={$t("toolbar.orderedList")}
    >
      <ListOrdered size={18} />
    </button>
    <button
      type="button"
      onclick={() =>
        run(() => editor?.chain().focus().liftListItem("listItem").run())}
      class={btnClass(false)}
      aria-label={$t("toolbar.outdent")}
      title={$t("toolbar.outdent")}
    >
      <ListIndentDecrease size={18} />
    </button>
    <button
      type="button"
      onclick={() =>
        run(() => editor?.chain().focus().sinkListItem("listItem").run())}
      class={btnClass(false)}
      aria-label={$t("toolbar.indent")}
      title={$t("toolbar.indent")}
    >
      <ListIndentIncrease size={18} />
    </button>
    <button
      type="button"
      onclick={() =>
        run(() => editor?.chain().focus().toggleBlockquote().run())}
      class={btnClass(isBlockActive("blockquote"))}
      aria-label={$t("toolbar.quote")}
      title={$t("toolbar.quote")}
    >
      <Quote size={18} />
    </button>
    <TablePicker {editor} />
  </div>
  {#if toolbarState.isInsideTable}
    <div class="mx-1.5 h-6 w-px shrink-0 bg-[var(--border)]"></div>
    <div class="flex animate-fade-in items-center gap-0.5">
      <div
        class="select-none px-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-[var(--warning)]"
      >
        {$t("toolbar.table")}
      </div>
      <button
        type="button"
        onclick={addRowBefore}
        class={btnClass(false)}
        aria-label={$t("toolbar.rowAbove")}
        title={$t("toolbar.rowAbove")}
      >
        <Rows3 size={18} />
      </button>
      <button
        type="button"
        onclick={addRowAfter}
        class={btnClass(false)}
        aria-label={$t("toolbar.rowBelow")}
        title={$t("toolbar.rowBelow")}
      >
        <Rows3 size={18} class="rotate-180" />
      </button>
      <button
        type="button"
        onclick={addColumnBefore}
        class={btnClass(false)}
        aria-label={$t("toolbar.colLeft")}
        title={$t("toolbar.colLeft")}
      >
        <Columns3 size={18} />
      </button>
      <button
        type="button"
        onclick={addColumnAfter}
        class={btnClass(false)}
        aria-label={$t("toolbar.colRight")}
        title={$t("toolbar.colRight")}
      >
        <Columns3 size={18} class="rotate-180" />
      </button>
      <button
        type="button"
        onclick={deleteRow}
        class={btnClass(false)}
        aria-label={$t("toolbar.deleteRow")}
        title={$t("toolbar.deleteRow")}
      >
        <Minus size={18} class="text-[var(--error)]" />
      </button>
      <button
        type="button"
        onclick={deleteColumn}
        class={btnClass(false)}
        aria-label={$t("toolbar.deleteCol")}
        title={$t("toolbar.deleteCol")}
      >
        <Minus size={18} class="rotate-90 text-[var(--error)]" />
      </button>
      <button
        type="button"
        onclick={deleteTable}
        class={`${TOOLBAR_BTN_BASE} hover:bg-[var(--error)]/10`}
        aria-label={$t("toolbar.deleteTable.button")}
        title={$t("toolbar.deleteTable.button")}
      >
        <Trash size={18} class="text-[var(--error)]" />
      </button>
    </div>
  {/if}
  <div class="mx-1.5 h-6 w-px shrink-0 bg-[var(--border)]"></div>
  <div class="flex items-center gap-0.5">
    <button
      type="button"
      onclick={handleCopy}
      class={btnClass(false)}
      aria-label={$t("toolbar.copyText")}
      title={$t("toolbar.copyText")}
    >
      <Copy size={18} />
    </button>
    <button
      type="button"
      onclick={handleClear}
      class={`${TOOLBAR_BTN_BASE} hover:bg-[var(--error)]/10`}
      aria-label={$t("toolbar.clearText.button")}
      title={$t("toolbar.clearText.button")}
    >
      <Trash2 size={18} class="text-[var(--error)]" />
    </button>
    <button
      type="button"
      onclick={handleClearDraft}
      class={`${TOOLBAR_BTN_BASE} hover:bg-[var(--accent-dim)]`}
      aria-label={$t("toolbar.clearProject.button")}
      title={$t("toolbar.clearProject.hint")}
    >
      <Eraser size={18} class="text-[var(--warning)]" />
    </button>
  </div>
  <div class="flex-1"></div>
  <div class="ml-2 flex shrink-0 items-center">
    <div bind:this={toolsMenuContainer} class="relative">
      <button
        type="button"
        onclick={toggleToolsMenu}
        class="{ACTION_BTN_BASE} {isToolsMenuOpen
          ? 'border-[var(--accent)] text-[var(--accent)]'
          : ''}"
        aria-haspopup="menu"
        aria-expanded={isToolsMenuOpen}
        aria-label={$t("toolbar.toolsOpen")}
      >
        <Wrench size={15} />
        <span>{$t("toolbar.tools")}</span>
      </button>
      {#if isToolsMenuOpen}
        <div
          role="menu"
          aria-label={$t("toolbar.toolsMenu")}
          class="absolute right-0 top-full z-50 mt-2 w-64 animate-fade-in rounded-[6px] border border-[var(--border-light)] bg-[var(--bg-medium)] p-1.5 shadow-[var(--shadow-md)]"
        >
          <button
            type="button"
            role="menuitem"
            onclick={() => {
              isToolsMenuOpen = false;
              isPreviewOpen.set(true);
            }}
            class={MENU_ITEM_BASE}
          >
            <Eye size={15} class="shrink-0" />
            <span class="flex-1">{$t("toolbar.preview")}</span>
          </button>
          <button
            type="button"
            role="menuitem"
            onclick={() => {
              isToolsMenuOpen = false;
              isExtractorOpen.set(true);
            }}
            class={MENU_ITEM_BASE}
          >
            <Brain size={15} class="shrink-0" />
            <span class="flex-1">{$t("toolbar.extractor")}</span>
          </button>
          <div class="mx-1 my-1.5 h-px bg-[var(--border)]"></div>
          <button
            type="button"
            role="menuitem"
            onclick={() => {
              isToolsMenuOpen = false;
              handleApplyTestData();
            }}
            class={MENU_ITEM_BASE}
          >
            <FlaskConical size={15} class="shrink-0" />
            <span class="flex-1">{$t("toolbar.testData")}</span>
          </button>
        </div>
      {/if}
    </div>
  </div>
</div>
