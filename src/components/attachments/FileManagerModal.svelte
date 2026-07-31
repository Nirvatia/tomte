<script lang="ts">
  import { X, FolderOpen, Trash2, CheckSquare, XSquare, Upload } from '@lucide/svelte';
  import FileItem from './FileItem.svelte';
  import FilePreviewModal from './FilePreviewModal.svelte';
  import type { AttachedFile } from '../../types';
  import { processFile } from '../../utils/files';
  import { get } from 'svelte/store';
  import { attachedFiles, selectedFileIds, isFileManagerOpen } from '../../stores';

  let previewFile: AttachedFile | null = $state(null);
  let dropZoneActive = $state(false);
  let fileInput: HTMLInputElement;

  async function handleFilesSelected(files: File[]) {
    for (const file of files) {
      try {
        const attachedFile = await processFile(file);
        attachedFiles.update(($files) => [...$files, attachedFile]);
      } catch (error) {
        console.error('Error processing file:', error);
      }
    }
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dropZoneActive = false;
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      handleFilesSelected(Array.from(files));
    }
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dropZoneActive = true;
  }

  function handleDragLeave(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    const related = e.relatedTarget as Node | null;
    const currentTarget = e.currentTarget as Node;
    if (!related || !currentTarget.contains(related)) {
      dropZoneActive = false;
    }
  }

  function handleFileInputChange(e: Event) {
    const input = e.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      handleFilesSelected(Array.from(input.files));
      input.value = '';
    }
  }

  function close() {
    isFileManagerOpen.set(false);
  }

  function toggleSelect(id: string) {
    selectedFileIds.update(($selected) => {
      const newSet = new Set($selected);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }

  function removeFile(id: string) {
    attachedFiles.update(($files) => $files.filter((f) => f.id !== id));
    selectedFileIds.update(($selected) => {
      const newSet = new Set($selected);
      newSet.delete(id);
      return newSet;
    });
  }

  function openPreview(file: AttachedFile) {
    previewFile = file;
  }

  function closePreview() {
    previewFile = null;
  }

  function selectAll() {
    selectedFileIds.set(new Set(get(attachedFiles).map((f) => f.id)));
  }

  function deselectAll() {
    selectedFileIds.set(new Set());
  }

  function deleteSelected() {
    const selectedIds = get(selectedFileIds);
    if (selectedIds.size === 0) return;
    if (!confirm(`Удалить ${selectedIds.size} файл(ов)?`)) return;
    attachedFiles.update(($files) => $files.filter((f) => !selectedIds.has(f.id)));
    selectedFileIds.set(new Set());
  }

  function deleteAll() {
    const files = get(attachedFiles);
    if (files.length === 0) return;
    if (!confirm(`Удалить все ${files.length} файл(ов)?`)) return;
    attachedFiles.set([]);
    selectedFileIds.set(new Set());
  }

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      close();
    }
  }
</script>

{#if $isFileManagerOpen}
  <div
    class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in"
    onclick={handleBackdropClick}
  >
    <div class="bg-surface rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] flex flex-col">
      <!-- Заголовок -->
      <div class="flex items-center justify-between p-6 border-b border-slate-100">
        <div>
          <h2 class="text-xl font-bold text-ink flex items-center gap-2">
            <FolderOpen size={24} class="text-brand-500" />
            Менеджер файлов
          </h2>
          <p class="text-sm text-ink-tertiary mt-1">
            Всего: <strong class="text-ink">{$attachedFiles.length}</strong>
            {#if $selectedFileIds.size > 0}
              <span class="ml-3">|</span>
              <span class="ml-3 text-brand-600 font-medium">Выбрано: {$selectedFileIds.size}</span>
            {/if}
          </p>
        </div>
        <button
          onclick={close}
          class="p-2 rounded-lg hover:bg-surface-tertiary text-ink-secondary hover:text-ink transition-colors"
          aria-label="Закрыть"
        >
          <X size={20} />
        </button>
      </div>

      <!-- Панель инструментов -->
      <div class="px-6 py-4 border-b border-slate-100 bg-surface-secondary">
        <div class="flex gap-2">
          <button
            onclick={selectAll}
            class="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg bg-surface hover:bg-surface-tertiary transition-colors flex items-center justify-center gap-2"
          >
            <CheckSquare size={16} />
            Выбрать всё
          </button>
          <button
            onclick={deselectAll}
            class="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg bg-surface hover:bg-surface-tertiary transition-colors flex items-center justify-center gap-2"
          >
            <XSquare size={16} />
            Снять выделение
          </button>
          <button
            onclick={deleteSelected}
            class="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors flex items-center justify-center gap-2"
            disabled={$selectedFileIds.size === 0}
          >
            <Trash2 size={16} />
            Удалить выбранные
          </button>
          <button
            onclick={() => fileInput.click()}
            class="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors flex items-center justify-center gap-2"
          >
            <Upload size={16} />
            Загрузить
          </button>
        </div>
      </div>

      <!-- Список файлов -->
      <div
        class="flex-1 overflow-y-auto p-6 relative transition-colors {dropZoneActive ? 'bg-brand-50 ring-2 ring-inset ring-brand-400' : ''}"
        ondrop={handleDrop}
        ondragover={handleDragOver}
        ondragleave={handleDragLeave}
      >
        {#if $attachedFiles.length === 0}
          <div class="text-center py-20 text-ink-tertiary">
            <FolderOpen size={48} class="mx-auto mb-4 opacity-50" />
            <p class="text-lg">Нет загруженных файлов</p>
            <p class="text-sm mt-2">Закройте это окно и загрузите файлы в правом сайдбаре</p>
          </div>
        {:else}
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            {#each $attachedFiles as file (file.id)}
              <FileItem
                {file}
                allFiles={$attachedFiles}
                isSelected={$selectedFileIds.has(file.id)}
                onToggleSelect={toggleSelect}
                onRemove={removeFile}
                onPreview={openPreview}
              />
            {/each}
          </div>
        {/if}

        {#if dropZoneActive}
          <div class="absolute inset-0 bg-brand-50/80 backdrop-blur-sm flex items-center justify-center pointer-events-none animate-fade-in rounded-lg z-10">
            <div class="text-center">
              <Upload size={36} class="mx-auto text-brand-500 mb-2" />
              <p class="text-sm font-semibold text-brand-700">Отпустите файлы для загрузки</p>
            </div>
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}

<input
  bind:this={fileInput}
  type="file"
  multiple
  class="hidden"
  onchange={handleFileInputChange}
  accept="image/*,.txt,.md,.py,.js,.html,.css,.json,.xml,.csv,.sql,.java,.cpp,.c,.h,.php,.rb,.go,.rs,.ts,.jsx,.tsx,.yaml,.yml,.svelte,.gd"
/>

<FilePreviewModal file={previewFile} onClose={closePreview} />