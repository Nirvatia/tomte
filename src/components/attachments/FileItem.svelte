<!-- FileItem.svelte -->
<script lang="ts">
  import { FileText, Eye, Trash2, Link } from "@lucide/svelte";
  import type { AttachedFile } from "../../types";
  import { formatFileSize } from "../../utils";
  import { getPlaceholderPrefix, getPlaceholderIndex } from "../../utils/files";
  let {
    file,
    allFiles = [],
    isSelected = false,
    onToggleSelect = () => {},
    onRemove = () => {},
    onPreview = () => {},
    onInsertPlaceholder = () => {},
  }: {
    file: AttachedFile;
    allFiles?: AttachedFile[];
    isSelected?: boolean;
    onToggleSelect?: (id: string) => void;
    onRemove?: (id: string) => void;
    onPreview?: (file: AttachedFile) => void;
    onInsertPlaceholder?: (file: AttachedFile) => void;
  } = $props();
  const prefix = $derived(getPlaceholderPrefix(file));
  const placeholderIndex = $derived(getPlaceholderIndex(file, allFiles));
  const badgeColor = $derived(
    file.type === "image"
      ? "text-brand-600 bg-brand-50"
      : "text-emerald-600 bg-emerald-50",
  );
  function handleCheckboxClick(e: Event) {
    e.stopPropagation();
    onToggleSelect(file.id);
  }
  function handleRemoveClick(e: Event) {
    e.stopPropagation();
    onRemove(file.id);
  }
  function handlePreviewClick(e: Event) {
    e.stopPropagation();
    onPreview(file);
  }
  function handleInsertPlaceholderClick(e: Event) {
    e.stopPropagation();
    onInsertPlaceholder(file);
  }
</script>

<!-- Внешний div используется только для layout, вся интерактивность внутри на честных элементах -->
<div
  class="group flex items-center gap-3 rounded-lg border p-3 transition-all {isSelected
    ? 'border-amb/50 bg-amb/10'
    : 'border-line bg-raised hover:border-line2 hover:bg-raised2'}"
>
  <input
    type="checkbox"
    checked={isSelected}
    onclick={handleCheckboxClick}
    class="mt-1 h-4 w-4 shrink-0 cursor-pointer rounded-sm accent-amb"
    aria-label="Выбрать файл {file.name}"
  />

  <div
    class="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md border border-line bg-inset"
  >
    {#if file.type === "image" && file.dataUrl}
      <img
        src={file.dataUrl}
        alt={file.name}
        class="h-full w-full object-cover"
      />
    {:else}
      <FileText size={20} class="text-amb2" />
    {/if}
  </div>

  <div class="min-w-0 flex-1">
    <p class="truncate text-sm font-medium text-txt">{file.name}</p>
    <div class="mt-0.5 flex items-center gap-2">
      <p class="text-xs text-txt3">{formatFileSize(file.size)}</p>
      <span class="rounded px-1.5 py-0.5 font-mono text-xs {badgeColor}">
        {prefix}_{placeholderIndex}
      </span>
    </div>
  </div>

  <div
    class="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100"
  >
    <button
      type="button"
      onclick={handleInsertPlaceholderClick}
      class="rounded-md p-1.5 text-txt2 transition-colors hover:bg-raised2 hover:text-txt"
      title="Вставить ссылку на файл"
      aria-label="Вставить ссылку на файл {file.name}"
    >
      <Link size={16} />
    </button>
    <button
      type="button"
      onclick={handlePreviewClick}
      class="rounded-md p-1.5 text-txt2 transition-colors hover:bg-raised2 hover:text-txt"
      title="Просмотреть файл"
      aria-label="Просмотреть файл {file.name}"
    >
      <Eye size={16} />
    </button>
    <button
      type="button"
      onclick={handleRemoveClick}
      class="rounded-md p-1.5 text-txt2 transition-colors hover:bg-red-50 hover:text-red-600"
      title="Удалить файл"
      aria-label="Удалить файл {file.name}"
    >
      <Trash2 size={16} />
    </button>
  </div>
</div>
