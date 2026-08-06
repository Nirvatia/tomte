<script lang="ts">
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
  } from "@lucide/svelte";
  import {
    isPreviewOpen,
    isExtractorOpen,
    attachedFiles,
    fileName,
    exportFormat,
    isProjectTreeOpen,
    selectedFileIds,
  } from "../../stores";
  import type { Editor } from "@tiptap/core";
  import TablePicker from "./TablePicker.svelte";
  import { clearDraft, clearProjectSource } from "../../utils/draft";
  import FontSizePicker from "./FontSizePicker.svelte";
  import { applyTestData } from "../../utils/testData";
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
    if (
      !confirm("Очистить черновик? Это удалит весь текст и загруженные файлы.")
    )
      return;
    editor?.commands.clearContent();
    attachedFiles.set([]);
    fileName.set("prompt");
    exportFormat.set("pdf");
    clearDraft();
    clearProjectSource();
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

<div
  class="flex h-13 shrink-0 items-center gap-0.5 overflow-x-auto border-b border-line bg-panel px-4"
>
  <!-- Панель структуры проекта -->
  <button
    type="button"
    onclick={toggleProjectTree}
    class="rounded-lg p-2 transition-all duration-200 {$isProjectTreeOpen
      ? 'bg-brand-100 text-brand-700 shadow-inner-soft'
      : 'text-txt2 hover:-translate-y-0.5 hover:bg-surface-tertiary hover:text-txt hover:shadow-soft'}"
    aria-label="Открыть панель структуры проекта"
    title="Структура проекта"
  >
    <FolderTree size={18} />
  </button>

  <div class="mx-2 h-6 w-px shrink-0 bg-line"></div>

  <!-- Undo / Redo -->
  <div class="flex items-center gap-0.5">
    <button
      type="button"
      onclick={() => run(() => editor?.chain().focus().undo().run())}
      disabled={!toolbarState.canUndo}
      class={TOOLBAR_BTN_BASE}
      aria-label="Отменить"
      title="Отменить (Ctrl+Z)"
    >
      <Undo2 size={18} />
    </button>
    <button
      type="button"
      onclick={() => run(() => editor?.chain().focus().redo().run())}
      disabled={!toolbarState.canRedo}
      class={TOOLBAR_BTN_BASE}
      aria-label="Повторить"
      title="Повторить (Ctrl+Y)"
    >
      <Redo2 size={18} />
    </button>
  </div>

  <div class="mx-2 h-6 w-px shrink-0 bg-line"></div>

  <!-- Заголовки -->
  <div class="flex items-center gap-0.5">
    <button
      type="button"
      onclick={() =>
        run(() => editor?.chain().focus().toggleHeading({ level: 1 }).run())}
      class={btnClass(isBlockActive("h1"))}
      aria-label="Заголовок 1"
      title="Заголовок 1"
    >
      <Heading1 size={18} />
    </button>
    <button
      type="button"
      onclick={() =>
        run(() => editor?.chain().focus().toggleHeading({ level: 2 }).run())}
      class={btnClass(isBlockActive("h2"))}
      aria-label="Заголовок 2"
      title="Заголовок 2"
    >
      <Heading2 size={18} />
    </button>
  </div>

  <div class="mx-2 h-6 w-px shrink-0 bg-line"></div>

  <!-- Размер шрифта -->
  <div class="flex items-center">
    <FontSizePicker {editor} />
  </div>

  <div class="mx-2 h-6 w-px shrink-0 bg-line"></div>

  <!-- Начертание -->
  <div class="flex items-center gap-0.5">
    <button
      type="button"
      onclick={() => run(() => editor?.chain().focus().toggleBold().run())}
      class={btnClass(isActive("bold"))}
      aria-label="Жирный"
      title="Жирный (Ctrl+B)"><Bold size={18} /></button
    >
    <button
      type="button"
      onclick={() => run(() => editor?.chain().focus().toggleItalic().run())}
      class={btnClass(isActive("italic"))}
      aria-label="Курсив"
      title="Курсив (Ctrl+I)"><Italic size={18} /></button
    >
    <button
      type="button"
      onclick={() => run(() => editor?.chain().focus().toggleUnderline().run())}
      class={btnClass(isActive("underline"))}
      aria-label="Подчёркнутый"
      title="Подчёркнутый (Ctrl+U)"><UnderlineIcon size={18} /></button
    >
    <button
      type="button"
      onclick={() => run(() => editor?.chain().focus().toggleStrike().run())}
      class={btnClass(isActive("strike"))}
      aria-label="Зачёркнутый"
      title="Зачёркнутый"><Strikethrough size={18} /></button
    >
    <button
      type="button"
      onclick={() => run(() => editor?.chain().focus().toggleHighlight().run())}
      class={btnClass(isActive("highlight"))}
      aria-label="Выделение"
      title="Выделение"><Highlighter size={18} /></button
    >
    <button
      type="button"
      onclick={() => run(() => editor?.chain().focus().toggleCode().run())}
      class={btnClass(isActive("code"))}
      aria-label="Код"
      title="Код"><Code size={18} /></button
    >
  </div>

  <div class="mx-2 h-6 w-px shrink-0 bg-line"></div>

  <!-- Списки, цитата, таблица -->
  <div class="flex items-center gap-0.5">
    <button
      type="button"
      onclick={() =>
        run(() => editor?.chain().focus().toggleBulletList().run())}
      class={btnClass(isBlockActive("bulletList"))}
      aria-label="Маркированный список"
      title="Маркированный список"><List size={18} /></button
    >
    <button
      type="button"
      onclick={() =>
        run(() => editor?.chain().focus().toggleOrderedList().run())}
      class={btnClass(isBlockActive("orderedList"))}
      aria-label="Нумерованный список"
      title="Нумерованный список"><ListOrdered size={18} /></button
    >
    <button
      type="button"
      onclick={() =>
        run(() => editor?.chain().focus().liftListItem("listItem").run())}
      class={TOOLBAR_BTN_BASE}
      aria-label="Уменьшить отступ"
      title="Уменьшить отступ"><ListIndentDecrease size={18} /></button
    >
    <button
      type="button"
      onclick={() =>
        run(() => editor?.chain().focus().sinkListItem("listItem").run())}
      class={TOOLBAR_BTN_BASE}
      aria-label="Увеличить отступ"
      title="Увеличить отступ"><ListIndentIncrease size={18} /></button
    >
    <button
      type="button"
      onclick={() =>
        run(() => editor?.chain().focus().toggleBlockquote().run())}
      class={btnClass(isBlockActive("blockquote"))}
      aria-label="Цитата"
      title="Цитата"><Quote size={18} /></button
    >
    <TablePicker {editor} />
  </div>

  {#if toolbarState.isInsideTable}
    <div class="mx-2 h-6 w-px shrink-0 bg-line"></div>

    <!-- Операции с таблицей -->
    <div class="flex animate-fade-in items-center gap-0.5">
      <div
        class="select-none px-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-amb"
      >
        Таблица
      </div>
      <button
        type="button"
        onclick={addRowBefore}
        class={TOOLBAR_BTN_BASE}
        aria-label="Добавить строку выше"
        title="Добавить строку выше"><Rows3 size={18} /></button
      >
      <button
        type="button"
        onclick={addRowAfter}
        class={TOOLBAR_BTN_BASE}
        aria-label="Добавить строку ниже"
        title="Добавить строку ниже"
        ><Rows3 size={18} class="rotate-180" /></button
      >
      <button
        type="button"
        onclick={addColumnBefore}
        class={TOOLBAR_BTN_BASE}
        aria-label="Добавить столбец слева"
        title="Добавить столбец слева"><Columns3 size={18} /></button
      >
      <button
        type="button"
        onclick={addColumnAfter}
        class={TOOLBAR_BTN_BASE}
        aria-label="Добавить столбец справа"
        title="Добавить столбец справа"
        ><Columns3 size={18} class="rotate-180" /></button
      >
      <button
        type="button"
        onclick={deleteRow}
        class={TOOLBAR_BTN_BASE}
        aria-label="Удалить строку"
        title="Удалить строку"><Minus size={18} class="text-red-600" /></button
      >
      <button
        type="button"
        onclick={deleteColumn}
        class={TOOLBAR_BTN_BASE}
        aria-label="Удалить столбец"
        title="Удалить столбец"
        ><Minus size={18} class="rotate-90 text-red-600" /></button
      >
      <button
        type="button"
        onclick={deleteTable}
        class={`${TOOLBAR_BTN_BASE} hover:bg-red-50`}
        aria-label="Удалить таблицу"
        title="Удалить таблицу"><Trash size={18} class="text-red-600" /></button
      >
    </div>
  {/if}

  <div class="mx-2 h-6 w-px shrink-0 bg-line"></div>

  <!-- Буфер / очистка -->
  <div class="flex items-center gap-0.5">
    <button
      type="button"
      onclick={handleCopy}
      class={TOOLBAR_BTN_BASE}
      aria-label="Копировать текст"
      title="Копировать текст"><Copy size={18} /></button
    >
    <button
      type="button"
      onclick={handleClear}
      class={`${TOOLBAR_BTN_BASE} hover:bg-red-50`}
      aria-label="Очистить весь текст"
      title="Очистить весь текст"
      ><Trash2 size={18} class="text-red-600" /></button
    >
    <button
      type="button"
      onclick={handleClearDraft}
      class={`${TOOLBAR_BTN_BASE} hover:bg-brand-100`}
      aria-label="Очистить черновик"
      title="Очистить черновик (текст + файлы)"
      ><Eraser size={18} class="text-amb" /></button
    >
  </div>

  <div class="flex-1"></div>

  <!-- Действия справа -->
  <div class="ml-2 flex shrink-0 items-center gap-2">
    <button
      type="button"
      onclick={() => applyTestData(editor, (name) => fileName.set(name))}
      class="flex items-center gap-2 rounded-lg border border-line bg-raised px-3 py-1.5 text-sm font-medium text-txt2 transition-all duration-200 hover:-translate-y-0.5 hover:bg-raised2 hover:text-txt hover:shadow-soft active:translate-y-0"
      aria-label="Заполнить редактор тестовыми данными"
      title="Заполнить редактор тестовыми данными"
    >
      <span>🧪 Тест</span>
    </button>
    <button
      type="button"
      onclick={() => isPreviewOpen.set(true)}
      class={`${ACTION_BTN_BASE} border border-line2 text-txt2 hover:border-amb hover:text-amb`}
      aria-label="Открыть предпросмотр"
    >
      <Eye size={16} />
      <span>Предпросмотр</span>
    </button>
    <button
      type="button"
      onclick={() => isExtractorOpen.set(true)}
      class={`${ACTION_BTN_BASE} border border-line2 text-txt2 hover:border-link hover:text-link`}
      aria-label="Открыть Smart Extractor"
    >
      <Brain size={16} />
      <span>Smart Extractor</span>
    </button>
  </div>
</div>
