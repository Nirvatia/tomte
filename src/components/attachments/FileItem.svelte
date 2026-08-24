<script lang="ts">
  import { CircleAlert, Eye, FileText, Link, Trash2 } from "@lucide/svelte";

  import Checkbox from "../ui/Checkbox.svelte";

  import type { AttachedFile } from "../../types";

  import { formatFileSize } from "../../utils";
  import { getPlaceholderIndex, getPlaceholderPrefix } from "../../utils/files";

  interface Props {
    file: AttachedFile;
    allFiles?: AttachedFile[];
    isSelected?: boolean;
    onToggleSelect?: (id: string) => void;
    onRemove?: (id: string) => void;
    onPreview?: (file: AttachedFile) => void;
    onInsertPlaceholder?: (file: AttachedFile) => void;
  }

  let {
    file,
    allFiles = [],
    isSelected = false,
    onToggleSelect = () => {},
    onRemove = () => {},
    onPreview = () => {},
    onInsertPlaceholder = () => {},
  }: Props = $props();

  const prefix = $derived(getPlaceholderPrefix(file));
  const placeholderIndex = $derived(getPlaceholderIndex(file, allFiles));

  const badgeColor = $derived(
    file.type === "image"
      ? "text-[var(--accent-hover)] bg-[var(--accent-dim)]"
      : "text-[var(--success)] bg-[var(--success)]/10",
  );

  const hasContent = $derived(
    file.type === "image"
      ? Boolean(file.dataUrl)
      : typeof file.content === "string",
  );

  function handleCheckboxClick(event: Event) {
    event.stopPropagation();
    onToggleSelect(file.id);
  }

  function handleRemoveClick(event: Event) {
    event.stopPropagation();
    onRemove(file.id);
  }

  function handlePreviewClick(event: Event) {
    event.stopPropagation();
    onPreview(file);
  }

  function handleInsertPlaceholderClick(event: Event) {
    event.stopPropagation();
    onInsertPlaceholder(file);
  }
</script>

<div
  class="group flex items-center gap-3 rounded-[6px] border p-3 transition-all duration-150 {isSelected
    ? 'border-[var(--accent)]/50 bg-[var(--accent-dim)]'
    : 'border-transparent bg-[var(--bg-light)] hover:border-[var(--border)] hover:bg-[var(--bg-lighter)] hover:shadow-[var(--shadow-sm)]'}"
>
  <div class="shrink-0">
    <Checkbox
      checked={isSelected}
      onToggle={handleCheckboxClick}
      ariaLabel="Выбрать файл {file.name}"
    />
  </div>

  <div
    class="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-[6px] border border-[var(--border)] bg-[var(--bg-darkest)]"
  >
    {#if file.type === "image" && file.dataUrl}
      <img
        src={file.dataUrl}
        alt={file.name}
        class="h-full w-full object-cover"
      />
    {:else}
      <FileText size={20} class="text-[var(--accent-hover)]" />
    {/if}
  </div>

  <div class="min-w-0 flex-1">
    <p class="truncate text-[13px] font-medium text-[var(--text-primary)]">
      {file.name}
    </p>

    <div class="mt-[3px] flex items-center gap-2">
      <p class="text-[11px] text-[var(--text-tertiary)]">
        {formatFileSize(file.size)}
      </p>

      <span class="rounded px-1.5 py-0.5 font-mono text-[11px] {badgeColor}">
        {prefix}_{placeholderIndex}
      </span>

      {#if !hasContent}
        <span
          class="inline-flex items-center text-[var(--warning)]"
          title="Содержимое не сохранено (только метаданные)"
          aria-label="Содержимое не сохранено"
        >
          <CircleAlert size={12} />
        </span>
      {/if}
    </div>
  </div>

  <div
    class="flex items-center gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100"
  >
    <button
      type="button"
      onclick={handleInsertPlaceholderClick}
      class="rounded-[4px] p-1.5 text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-lighter)] hover:text-[var(--text-primary)]"
      title="Вставить ссылку на файл"
      aria-label="Вставить ссылку на файл {file.name}"
    >
      <Link size={16} />
    </button>

    <button
      type="button"
      onclick={handlePreviewClick}
      class="rounded-[4px] p-1.5 text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-lighter)] hover:text-[var(--text-primary)]"
      title="Просмотреть файл"
      aria-label="Просмотреть файл {file.name}"
    >
      <Eye size={16} />
    </button>

    <button
      type="button"
      onclick={handleRemoveClick}
      class="rounded-[4px] p-1.5 text-[var(--text-secondary)] transition-colors hover:bg-[var(--error)]/10 hover:text-[var(--error)]"
      title="Удалить файл"
      aria-label="Удалить файл {file.name}"
    >
      <Trash2 size={16} />
    </button>
  </div>
</div>
