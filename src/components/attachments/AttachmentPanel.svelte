<script lang="ts">
  import { attachedFiles, selectedFileIds, isFileManagerOpen } from '../../stores';
  import { totalFilesCount, selectedFilesCount } from '../../stores';
  import { FolderOpen, ChevronDown, CheckSquare, XSquare, Trash2, Download, Upload } from '@lucide/svelte';
  import FileItem from './FileItem.svelte';
  import FilePreviewModal from './FilePreviewModal.svelte';
  import type { AttachedFile } from '../../types';
  import { processFile, readDroppedFiles, isFileReadable } from '../../utils/files';

  let {
    editor = null,
    onInsertPlaceholder = (file: AttachedFile) => {},
    onInsertContent = (file: AttachedFile) => {}
  }: {
    editor?: any;
    onInsertPlaceholder?: (file: AttachedFile) => void;
    onInsertContent?: (file: AttachedFile) => void;
  } = $props();

  let exportMenuOpen = $state(false);
  let selectMenuOpen = $state(false);
  let deleteMenuOpen = $state(false);
  let previewFile: AttachedFile | null = $state(null);
  let dropZoneActive = $state(false);
  let fileInput: HTMLInputElement;
  let folderInput: HTMLInputElement;

  async function handleFilesSelected(files: File[]) {
    for (const file of files) {
      try {
        // Проверяем доступность файла перед обработкой
        const readable = await isFileReadable(file);
        if (!readable) {
          console.warn(`Skipping unreadable file: ${file.name}`);
          continue;
        }
        
        const attachedFile = await processFile(file);
        attachedFiles.update(($files) => [...$files, attachedFile]);
      } catch (error) {
        console.error(`Error processing file "${file.name}":`, error);
      }
    }
  }

  async function handleDrop(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dropZoneActive = false;
    const items = e.dataTransfer?.items;
    if (items && items.length > 0) {
      const files = await readDroppedFiles(items);
      if (files.length > 0) {
        handleFilesSelected(files);
      }
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
    // Сбрасываем только если уходим за пределы контейнера списка
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
      input.value = ''; // сброс для повторного выбора того же файла
    }
  }

  function handleFolderInputChange(e: Event) {
    const input = e.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      handleFilesSelected(Array.from(input.files));
      input.value = ''; // сброс для повторного выбора той же папки
    }
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

  function toggleExport(id: string) {
    attachedFiles.update(($files) =>
      $files.map((f) => (f.id === id ? { ...f, includeInExport: !f.includeInExport } : f))
    );
  }

  function selectAll() {
    selectedFileIds.set(new Set($attachedFiles.map((f) => f.id)));
    selectMenuOpen = false;
  }

  function deselectAll() {
    selectedFileIds.set(new Set());
    selectMenuOpen = false;
  }

  function toggleAllExports(state: boolean) {
    attachedFiles.update(($files) =>
      $files.map((f) => (f.type === 'text' ? { ...f, includeInExport: state } : f))
    );
    exportMenuOpen = false;
  }

  function toggleExportSelected(state: boolean) {
    if ($selectedFileIds.size === 0) return;
    attachedFiles.update(($files) =>
      $files.map((f) =>
        $selectedFileIds.has(f.id) && f.type === 'text'
          ? { ...f, includeInExport: state }
          : f
      )
    );
    exportMenuOpen = false;
  }

  function deleteSelected() {
    if ($selectedFileIds.size === 0) return;
    if (!confirm(`Удалить ${$selectedFileIds.size} файл(ов)?`)) return;
    attachedFiles.update(($files) => $files.filter((f) => !$selectedFileIds.has(f.id)));
    selectedFileIds.set(new Set());
    deleteMenuOpen = false;
  }

  function deleteAll() {
    if ($attachedFiles.length === 0) return;
    if (!confirm(`Удалить все ${$attachedFiles.length} файл(ов)?`)) return;
    attachedFiles.set([]);
    selectedFileIds.set(new Set());
    deleteMenuOpen = false;
  }

  function closeAllMenus() {
    exportMenuOpen = false;
    selectMenuOpen = false;
    deleteMenuOpen = false;
  }

  function handleClickOutside(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (!target.closest('.dropdown-container')) {
      closeAllMenus();
    }
  }
</script>

<svelte:window on:click={handleClickOutside} />

<div class="w-[400px] shrink-0 flex flex-col bg-surface border-l border-slate-200 overflow-hidden h-full">
  <div class="p-4 border-b border-slate-100 bg-surface-secondary shrink-0">
    <div class="flex items-center justify-between mb-3">
      <h2 class="font-bold text-ink flex items-center gap-2">
        <FolderOpen size={18} class="text-brand-500" />
        Вложения
      </h2>
      <div class="flex items-center gap-2 text-xs">
        <span class="text-ink-tertiary">
          <strong class="text-ink">{$totalFilesCount}</strong>
        </span>
        {#if $selectedFilesCount > 0}
          <span class="text-slate-300">|</span>
          <span class="text-brand-600 font-medium">
            ✓ {$selectedFilesCount}
          </span>
        {/if}
      </div>
    </div>

    <div class="flex gap-2">
      <div class="relative flex-1 dropdown-container">
        <button
          on:click={(e) => {
            e.stopPropagation();
            exportMenuOpen = !exportMenuOpen;
            selectMenuOpen = false;
            deleteMenuOpen = false;
          }}
          class="w-full px-3 py-2 text-xs font-medium rounded-lg bg-surface-tertiary hover:bg-slate-200 transition-colors flex items-center justify-between gap-2"
        >
          <span class="flex items-center gap-1.5">
            <Download size={14} />
            Экспорт
          </span>
          <ChevronDown size={12} class="transition-transform {exportMenuOpen ? 'rotate-180' : ''}" />
        </button>
        {#if exportMenuOpen}
          <div class="absolute top-full left-0 right-0 mt-1 bg-surface rounded-lg shadow-lg border border-slate-200 py-1 z-10">
            <button on:click={() => toggleAllExports(true)} class="w-full px-3 py-2 text-xs text-left hover:bg-surface-tertiary transition-colors">
              Включить все тексты
            </button>
            <button on:click={() => toggleAllExports(false)} class="w-full px-3 py-2 text-xs text-left hover:bg-surface-tertiary transition-colors">
              Выключить все тексты
            </button>
            <div class="border-t border-slate-100 my-1"></div>
            <button on:click={() => toggleExportSelected(true)} class="w-full px-3 py-2 text-xs text-left hover:bg-surface-tertiary transition-colors" disabled={$selectedFilesCount === 0}>
              Вкл. для выбранных
            </button>
            <button on:click={() => toggleExportSelected(false)} class="w-full px-3 py-2 text-xs text-left hover:bg-surface-tertiary transition-colors" disabled={$selectedFilesCount === 0}>
              Выкл. для выбранных
            </button>
          </div>
        {/if}
      </div>

      <div class="relative flex-1 dropdown-container">
        <button
          on:click={(e) => {
            e.stopPropagation();
            selectMenuOpen = !selectMenuOpen;
            exportMenuOpen = false;
            deleteMenuOpen = false;
          }}
          class="w-full px-3 py-2 text-xs font-medium rounded-lg bg-surface-tertiary hover:bg-slate-200 transition-colors flex items-center justify-between gap-2"
        >
          <span class="flex items-center gap-1.5">
            <CheckSquare size={14} />
            Выбор
          </span>
          <ChevronDown size={12} class="transition-transform {selectMenuOpen ? 'rotate-180' : ''}" />
        </button>
        {#if selectMenuOpen}
          <div class="absolute top-full left-0 right-0 mt-1 bg-surface rounded-lg shadow-lg border border-slate-200 py-1 z-10">
            <button on:click={selectAll} class="w-full px-3 py-2 text-xs text-left hover:bg-surface-tertiary transition-colors">
              Выбрать всё
            </button>
            <button on:click={deselectAll} class="w-full px-3 py-2 text-xs text-left hover:bg-surface-tertiary transition-colors">
              Снять выделение
            </button>
          </div>
        {/if}
      </div>

      <div class="relative flex-1 dropdown-container">
        <button
          on:click={(e) => {
            e.stopPropagation();
            deleteMenuOpen = !deleteMenuOpen;
            exportMenuOpen = false;
            selectMenuOpen = false;
          }}
          class="w-full px-3 py-2 text-xs font-medium rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors flex items-center justify-between gap-2"
        >
          <span class="flex items-center gap-1.5">
            <Trash2 size={14} />
            Удалить
          </span>
          <ChevronDown size={12} class="transition-transform {deleteMenuOpen ? 'rotate-180' : ''}" />
        </button>
        {#if deleteMenuOpen}
          <div class="absolute top-full left-0 right-0 mt-1 bg-surface rounded-lg shadow-lg border border-slate-200 py-1 z-10">
            <button on:click={deleteSelected} class="w-full px-3 py-2 text-xs text-left hover:bg-surface-tertiary transition-colors" disabled={$selectedFilesCount === 0}>
              Удалить выбранные
            </button>
            <button on:click={deleteAll} class="w-full px-3 py-2 text-xs text-left hover:bg-surface-tertiary transition-colors">
              Удалить все
            </button>
          </div>
        {/if}
      </div>
    </div>
  </div>

  <div class="px-4 pt-3 pb-2 border-b border-slate-100 shrink-0 space-y-2">
    <button
      on:click={() => fileInput.click()}
      class="w-full py-2 px-3 bg-surface-tertiary text-ink rounded-lg font-medium text-sm hover:bg-slate-200 transition-colors flex items-center justify-center gap-2 border border-slate-200"
    >
      <Upload size={16} />
      Загрузить файлы
    </button>
    <input
      bind:this={fileInput}
      type="file"
      multiple
      class="hidden"
      on:change={handleFileInputChange}
      accept="image/*,.txt,.md,.py,.js,.html,.css,.json,.xml,.csv,.sql,.java,.cpp,.c,.h,.php,.rb,.go,.rs,.ts,.jsx,.tsx,.yaml,.yml,.svelte,.gd"
    />

    <button
      on:click={() => folderInput.click()}
      class="w-full py-2 px-3 bg-surface-tertiary text-ink rounded-lg font-medium text-sm hover:bg-slate-200 transition-colors flex items-center justify-center gap-2 border border-slate-200"
    >
      <FolderOpen size={16} />
      Загрузить папку
    </button>
    <input
      bind:this={folderInput}
      type="file"
      multiple
      class="hidden"
      on:change={handleFolderInputChange}
      webkitdirectory
      directory
      mozdirectory
    />
  </div>

  <div class="px-4 pb-3 shrink-0">
    <button
      on:click={() => isFileManagerOpen.set(true)}
      class="w-full py-2 px-3 bg-brand-500 text-white rounded-lg font-medium text-sm hover:bg-brand-600 transition-colors flex items-center justify-center gap-2"
    >
      <FolderOpen size={16} />
      Менеджер файлов
    </button>
  </div>

  <div
    class="flex-1 overflow-y-auto p-4 space-y-2 min-h-0 relative transition-colors {dropZoneActive
      ? 'bg-brand-50 ring-2 ring-inset ring-brand-400'
      : ''}"
    on:drop={handleDrop}
    on:dragover={handleDragOver}
    on:dragleave={handleDragLeave}
  >
    {#if $attachedFiles.length === 0}
      <div class="text-center py-10 text-ink-tertiary">
        <FolderOpen size={32} class="mx-auto mb-3 opacity-50" />
        <p class="text-sm">Нет загруженных файлов</p>
        <p class="text-xs mt-1">Нажмите «Загрузить файлы» или перетащите их сюда</p>
      </div>
    {:else}
      {#each $attachedFiles as file, index (file.id)}
        <FileItem
          {file}
          {index}
          isSelected={$selectedFileIds.has(file.id)}
          allFiles={$attachedFiles}
          onToggleSelect={toggleSelect}
          onRemove={removeFile}
          onPreview={openPreview}
          onInsertPlaceholder={onInsertPlaceholder}
          onInsertContent={onInsertContent}
          onToggleExport={toggleExport}
        />
      {/each}
    {/if}

    {#if dropZoneActive}
      <div class="absolute inset-0 bg-brand-50/80 backdrop-blur-sm flex items-center justify-center pointer-events-none animate-fade-in rounded-lg">
        <div class="text-center">
          <Upload size={36} class="mx-auto text-brand-500 mb-2" />
          <p class="text-sm font-semibold text-brand-700">Отпустите файлы для загрузки</p>
        </div>
      </div>
    {/if}
  </div>
</div>

<FilePreviewModal file={previewFile} onClose={closePreview} />