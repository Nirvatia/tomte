<script lang="ts">
  import { Image as ImageIcon, FileText, Eye, Trash2, FileInput } from '@lucide/svelte';
  import type { AttachedFile } from '../../types';
  import { formatFileSize } from '../../utils';
  import { getPlaceholderPrefix, getPlaceholderIndex } from '../../utils/files';

  let {
    file,
    index,
    isSelected = false,
    allFiles = [],
    onToggleSelect = () => {},
    onRemove = () => {},
    onPreview = () => {},
    onInsertPlaceholder = () => {},
    onInsertContent = () => {},
    onToggleExport = () => {}
  }: {
    file: AttachedFile;
    index: number;
    isSelected?: boolean;
    allFiles?: AttachedFile[];
    onToggleSelect?: (id: string) => void;
    onRemove?: (id: string) => void;
    onPreview?: (file: AttachedFile) => void;
    onInsertPlaceholder?: (file: AttachedFile) => void;
    onInsertContent?: (file: AttachedFile) => void;
    onToggleExport?: (id: string) => void;
  } = $props();

  const prefix = $derived(getPlaceholderPrefix(file));
  const placeholderIndex = $derived(getPlaceholderIndex(file, allFiles));
  const badgeColor = $derived(file.type === 'image' ? 'text-brand-600 bg-brand-50' : 'text-emerald-600 bg-emerald-50');

  function handleClick(e: MouseEvent) {
    // Если клик не по кнопке или чекбоксу — вставляем плейсхолдер
    const target = e.target as HTMLElement;
    if (!target.closest('button') && !target.closest('input[type="checkbox"]')) {
      onInsertPlaceholder(file);
    }
  }

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

  function handleInsertContentClick(e: Event) {
    e.stopPropagation();
    onInsertContent(file);
  }

  function handleToggleExportChange(e: Event) {
    e.stopPropagation();
    onToggleExport(file.id);
  }
</script>

<div
  class="group flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer {isSelected
    ? 'border-brand-400 bg-brand-50 shadow-soft-sm'
    : 'border-slate-100 bg-surface-secondary hover:border-brand-200 hover:shadow-soft'}"
  onclick={handleClick}
  role="button"
  tabindex="0"
  aria-label="Файл {file.name}"
>
  <!-- Чекбокс выбора -->
  <input
    type="checkbox"
    checked={isSelected}
    onclick={handleCheckboxClick}
    class="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 focus:ring-2 cursor-pointer"
    aria-label="Выбрать файл"
  />

  <!-- Иконка/Превью -->
  <div class="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-surface-tertiary flex items-center justify-center">
    {#if file.type === 'image' && file.dataUrl}
      <img src={file.dataUrl} alt={file.name} class="w-full h-full object-cover" />
    {:else}
      <FileText size={20} class="text-brand-600" />
    {/if}
  </div>

  <!-- Информация -->
  <div class="flex-1 min-w-0">
    <p class="text-sm font-medium text-ink truncate">{file.name}</p>
    <div class="flex items-center gap-2 mt-0.5">
      <p class="text-xs text-ink-tertiary">{formatFileSize(file.size)}</p>
      <span class="text-xs font-mono px-1.5 py-0.5 rounded {badgeColor}">
        {prefix}_{placeholderIndex}
      </span>
    </div>
  </div>

  <!-- Действия -->
  <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
    {#if file.type === 'text'}
      <input
        type="checkbox"
        checked={file.includeInExport}
        onchange={handleToggleExportChange}
        class="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 focus:ring-2 cursor-pointer"
        title="Включить содержимое в экспорт"
        aria-label="Включить в экспорт"
      />
    {/if}
    <button
      onclick={handlePreviewClick}
      class="p-1.5 rounded-lg hover:bg-surface-tertiary text-ink-secondary hover:text-ink transition-colors"
      title="Просмотр"
      aria-label="Просмотреть файл"
    >
      <Eye size={16} />
    </button>
    {#if file.type === 'text'}
      <button
        onclick={handleInsertContentClick}
        class="p-1.5 rounded-lg hover:bg-surface-tertiary text-ink-secondary hover:text-ink transition-colors"
        title="Вставить содержимое"
        aria-label="Вставить содержимое файла"
      >
        <FileInput size={16} />
      </button>
    {/if}
    <button
      onclick={handleRemoveClick}
      class="p-1.5 rounded-lg hover:bg-red-50 text-ink-secondary hover:text-red-500 transition-colors"
      title="Удалить"
      aria-label="Удалить файл"
    >
      <Trash2 size={16} />
    </button>
  </div>
</div>