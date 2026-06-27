<script lang="ts">
  import {
    Undo2,
    Redo2,
    Copy,
    Trash2,
    List,
    ListOrdered,
    Indent,
    Outdent,
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
  } from "@lucide/svelte";

  import {
    isPreviewOpen,
    isExtractorOpen,
    attachedFiles,
    fileName,
    exportFormat,
    isProjectTreeOpen,
  } from "../../stores";
  import type { Editor } from "@tiptap/core";
  import TablePicker from "./TablePicker.svelte";
  import { clearDraft } from "../../utils/draft";
  import FontSizePicker from "./FontSizePicker.svelte";

  let { editor = null }: { editor?: Editor | null } = $props();

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

  function handleClearDraft() {
    if (!confirm("Очистить черновик? Это удалит весь текст и загруженные файлы.")) return;

    editor?.commands.clearContent();
    attachedFiles.set([]);
    fileName.set("prompt");
    exportFormat.set("pdf");
    clearDraft();
  }

  function isActive(mark: string): boolean {
    return toolbarState.activeMarks.has(mark);
  }

  function isBlockActive(block: string): boolean {
    return toolbarState.activeBlocks.has(block);
  }

  function btnClass(active: boolean): string {
    return `${TOOLBAR_BTN_BASE} ${active ? TOOLBAR_BTN_ACTIVE : ""}`;
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

  function handleClear() {
    if (!editor) return;
    if (confirm("Очистить весь текст?")) {
      editor.commands.clearContent();
    }
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
  function deleteTable() {
    if (!editor) return;
    if (confirm("Удалить таблицу?")) {
      editor.chain().focus().deleteTable().run();
    }
  }

  const TOOLBAR_BTN_BASE =
    "p-2 rounded-lg text-ink-secondary transition-all duration-200 hover:bg-surface-tertiary hover:text-ink hover:-translate-y-0.5 hover:shadow-soft active:translate-y-0 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none";
  const TOOLBAR_BTN_ACTIVE = "bg-brand-100 text-brand-700 shadow-inner-soft";
  const ACTION_BTN_BASE =
    "flex items-center gap-2 px-3 py-1.5 rounded-lg font-medium text-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-soft active:translate-y-0";
</script>

<div class="bg-surface border-b border-slate-200 px-6 py-2 flex items-center gap-1 shadow-soft-sm shrink-0">
  <button
    onclick={toggleProjectTree}
    class="p-2 rounded-lg transition-all duration-200 {$isProjectTreeOpen ? 'bg-blue-100 text-blue-700 border border-blue-300' : 'text-ink-secondary hover:bg-surface-tertiary hover:text-ink hover:-translate-y-0.5 hover:shadow-soft'}"
    title="Структура проекта"
    aria-label="Открыть панель структуры проекта"
  >
    <FolderTree size={18} />
  </button>

  <div class="w-4 mr-1 border-r border-slate-200 h-6"></div>

  <div class="flex items-center gap-0.5 pr-2 mr-1 border-r border-slate-200">
    <button
      onclick={() => run(() => editor?.chain().focus().undo().run())}
      disabled={!toolbarState.canUndo}
      class={TOOLBAR_BTN_BASE}
      title="Отменить (Ctrl+Z)"
    >
      <Undo2 size={18} />
    </button>
    <button
      onclick={() => run(() => editor?.chain().focus().redo().run())}
      disabled={!toolbarState.canRedo}
      class={TOOLBAR_BTN_BASE}
      title="Повторить (Ctrl+Y)"
    >
      <Redo2 size={18} />
    </button>
  </div>

  <div class="flex items-center gap-0.5 px-2 mr-1 border-r border-slate-200">
    <button
      onclick={() => run(() => editor?.chain().focus().toggleHeading({ level: 1 }).run())}
      class={btnClass(isBlockActive("h1"))}
      title="Заголовок 1"
    >
      <Heading1 size={18} />
    </button>
    <button
      onclick={() => run(() => editor?.chain().focus().toggleHeading({ level: 2 }).run())}
      class={btnClass(isBlockActive("h2"))}
      title="Заголовок 2"
    >
      <Heading2 size={18} />
    </button>
  </div>

  <div class="flex items-center gap-0.5 px-2 mr-1 border-r border-slate-200">
    <FontSizePicker {editor} />
  </div>

  <div class="flex items-center gap-0.5 px-2 mr-1 border-r border-slate-200">
    <button
      onclick={() => run(() => editor?.chain().focus().toggleBold().run())}
      class={btnClass(isActive("bold"))}
      title="Жирный (Ctrl+B)"
    >
      <Bold size={18} />
    </button>
    <button
      onclick={() => run(() => editor?.chain().focus().toggleItalic().run())}
      class={btnClass(isActive("italic"))}
      title="Курсив (Ctrl+I)"
    >
      <Italic size={18} />
    </button>
    <button
      onclick={() => run(() => editor?.chain().focus().toggleUnderline().run())}
      class={btnClass(isActive("underline"))}
      title="Подчёркнутый (Ctrl+U)"
    >
      <UnderlineIcon size={18} />
    </button>
    <button
      onclick={() => run(() => editor?.chain().focus().toggleStrike().run())}
      class={btnClass(isActive("strike"))}
      title="Зачёркнутый"
    >
      <Strikethrough size={18} />
    </button>
    <button
      onclick={() => run(() => editor?.chain().focus().toggleHighlight().run())}
      class={btnClass(isActive("highlight"))}
      title="Выделение"
    >
      <Highlighter size={18} />
    </button>
    <button
      onclick={() => run(() => editor?.chain().focus().toggleCode().run())}
      class={btnClass(isActive("code"))}
      title="Код"
    >
      <Code size={18} />
    </button>
  </div>

  <div class="flex items-center gap-0.5 px-2 mr-1 border-r border-slate-200">
    <button
      onclick={() => run(() => editor?.chain().focus().toggleBulletList().run())}
      class={btnClass(isBlockActive("bulletList"))}
      title="Маркированный список"
    >
      <List size={18} />
    </button>
    <button
      onclick={() => run(() => editor?.chain().focus().toggleOrderedList().run())}
      class={btnClass(isBlockActive("orderedList"))}
      title="Нумерованный список"
    >
      <ListOrdered size={18} />
    </button>
    <button
      onclick={() => run(() => editor?.chain().focus().liftListItem("listItem").run())}
      class={TOOLBAR_BTN_BASE}
      title="Уменьшить отступ"
    >
      <Outdent size={18} />
    </button>
    <button
      onclick={() => run(() => editor?.chain().focus().sinkListItem("listItem").run())}
      class={TOOLBAR_BTN_BASE}
      title="Увеличить отступ"
    >
      <Indent size={18} />
    </button>
    <button
      onclick={() => run(() => editor?.chain().focus().toggleBlockquote().run())}
      class={btnClass(isBlockActive("blockquote"))}
      title="Цитата"
    >
      <Quote size={18} />
    </button>

    <TablePicker {editor} />
  </div>

  {#if toolbarState.isInsideTable}
    <div class="flex items-center gap-0.5 px-2 mr-1 border-r border-slate-200 animate-fade-in">
      <div class="text-[10px] font-semibold text-brand-600 uppercase tracking-wider px-1 select-none">
        Таблица
      </div>
      <button onclick={addRowBefore} class={TOOLBAR_BTN_BASE} title="Добавить строку выше">
        <Rows3 size={18} />
      </button>
      <button onclick={addRowAfter} class={TOOLBAR_BTN_BASE} title="Добавить строку ниже">
        <Rows3 size={18} class="rotate-180" />
      </button>
      <button onclick={addColumnBefore} class={TOOLBAR_BTN_BASE} title="Добавить столбец слева">
        <Columns3 size={18} />
      </button>
      <button onclick={addColumnAfter} class={TOOLBAR_BTN_BASE} title="Добавить столбец справа">
        <Columns3 size={18} class="rotate-180" />
      </button>
      <button onclick={deleteRow} class={TOOLBAR_BTN_BASE} title="Удалить строку">
        <Minus size={18} class="text-orange-500" />
      </button>
      <button onclick={deleteColumn} class={TOOLBAR_BTN_BASE} title="Удалить столбец">
        <Minus size={18} class="text-orange-500 rotate-90" />
      </button>
      <button
        onclick={deleteTable}
        class={`${TOOLBAR_BTN_BASE} text-red-500 hover:bg-red-50 hover:text-red-600`}
        title="Удалить таблицу"
      >
        <Trash size={18} />
      </button>
    </div>
  {/if}

  <div class="flex items-center gap-0.5 px-2 mr-1 border-r border-slate-200">
    <button onclick={handleCopy} class={TOOLBAR_BTN_BASE} title="Копировать текст">
      <Copy size={18} />
    </button>
    <button
      onclick={handleClear}
      class={`${TOOLBAR_BTN_BASE} text-red-500 hover:bg-red-50 hover:text-red-600`}
      title="Очистить весь текст"
    >
      <Trash2 size={18} />
    </button>
    <button
      onclick={handleClearDraft}
      class={`${TOOLBAR_BTN_BASE} text-amber-500 hover:bg-amber-50 hover:text-amber-600`}
      title="Очистить черновик (текст + файлы)"
    >
      <Eraser size={18} />
    </button>
  </div>

  <div class="flex-1"></div>

  <div class="flex items-center gap-2">
    <button
      onclick={() => isPreviewOpen.set(true)}
      class={`${ACTION_BTN_BASE} bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200`}
    >
      <Eye size={16} />
      <span>Предпросмотр</span>
    </button>
    <button
      onclick={() => isExtractorOpen.set(true)}
      class={`${ACTION_BTN_BASE} bg-purple-50 text-purple-600 hover:bg-purple-100 border border-purple-200`}
    >
      <Brain size={16} />
      <span>Smart Extractor</span>
    </button>
  </div>
</div>