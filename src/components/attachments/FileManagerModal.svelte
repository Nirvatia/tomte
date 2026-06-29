<script lang="ts">
  import { X, FolderOpen, Download, Trash2, CheckSquare, XSquare, ChevronDown, Upload } from '@lucide/svelte';
  import FileItem from './FileItem.svelte';
  import FilePreviewModal from './FilePreviewModal.svelte';
  import type { AttachedFile } from '../../types';
  import { processFile, readDroppedFiles, isFileReadable } from '../../utils/files';
  import { get } from 'svelte/store';
  import { attachedFiles, selectedFileIds, isFileManagerOpen } from '../../stores';

  let previewFile: AttachedFile | null = $state(null);
  let exportMenuOpen = $state(false);
  let selectMenuOpen = $state(false);
  let deleteMenuOpen = $state(false);

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

  function toggleExport(id: string) {
    attachedFiles.update(($files) =>
      $files.map((f) => (f.id === id ? { ...f, includeInExport: !f.includeInExport } : f))
    );
  }

  function selectAll() {
    selectedFileIds.set(new Set(get(attachedFiles).map((f) => f.id)));
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
    const selectedIds = get(selectedFileIds);
    if (selectedFileIds.size === 0) return;
    attachedFiles.update(($files) =>
      $files.map((f) =>
        selectedIds.has(f.id) && f.type === 'text'
          ? { ...f, includeInExport: state }
          : f
      )
    );
    exportMenuOpen = false;
  }

    function deleteSelected() {
    const selectedIds = get(selectedFileIds); // <-- сохраняем значение в переменную
    if (selectedIds.size === 0) return;
    if (!confirm(`Удалить ${selectedIds.size} файл(ов)?`)) return;
    attachedFiles.update(($files) => $files.filter((f) => !selectedIds.has(f.id))); // <-- используем переменную
    selectedFileIds.set(new Set());
    deleteMenuOpen = false;
  }

    function deleteAll() {
    const files = get(attachedFiles); // <-- сохраняем значение в переменную
    if (files.length === 0) return;
    if (!confirm(`Удалить все ${files.length} файл(ов)?`)) return;
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

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      close();
    }
  }
</script>

<svelte:window onclick={handleClickOutside} />

{#if $isFileManagerOpen}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
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
          <!-- Экспорт -->
          <div class="relative flex-1 dropdown-container">
            <button
              onclick={(e) => {
                e.stopPropagation();
                exportMenuOpen = !exportMenuOpen;
                selectMenuOpen = false;
                deleteMenuOpen = false;
              }}
              class="w-full px-4 py-2.5 text-sm font-medium rounded-lg bg-surface hover:bg-surface-tertiary transition-colors flex items-center justify-between gap-2"
            >
              <span class="flex items-center gap-2">
                <Download size={16} />
                Экспорт
              </span>
              <ChevronDown size={14} class="transition-transform {exportMenuOpen ? 'rotate-180' : ''}" />
            </button>
            {#if exportMenuOpen}
              <div class="absolute top-full left-0 right-0 mt-1 bg-surface rounded-lg shadow-lg border border-slate-200 py-1 z-10">
                <button
                  onclick={() => toggleAllExports(true)}
                  class="w-full px-4 py-2.5 text-sm text-left hover:bg-surface-tertiary transition-colors"
                >
                  Включить все тексты
                </button>
                <button
                  onclick={() => toggleAllExports(false)}
                  class="w-full px-4 py-2.5 text-sm text-left hover:bg-surface-tertiary transition-colors"
                >
                  Выключить все тексты
                </button>
                <div class="border-t border-slate-100 my-1"></div>
                <button
                  onclick={() => toggleExportSelected(true)}
                  class="w-full px-4 py-2.5 text-sm text-left hover:bg-surface-tertiary transition-colors"
                  disabled={$selectedFileIds.size === 0}
                >
                  Вкл. для выбранных
                </button>
                <button
                  onclick={() => toggleExportSelected(false)}
                  class="w-full px-4 py-2.5 text-sm text-left hover:bg-surface-tertiary transition-colors"
                  disabled={$selectedFileIds.size === 0}
                >
                  Выкл. для выбранных
                </button>
              </div>
            {/if}
          </div>

          <!-- Выделение -->
          <div class="relative flex-1 dropdown-container">
            <button
              onclick={(e) => {
                e.stopPropagation();
                selectMenuOpen = !selectMenuOpen;
                exportMenuOpen = false;
                deleteMenuOpen = false;
              }}
              class="w-full px-4 py-2.5 text-sm font-medium rounded-lg bg-surface hover:bg-surface-tertiary transition-colors flex items-center justify-between gap-2"
            >
              <span class="flex items-center gap-2">
                <CheckSquare size={16} />
                Выбор
              </span>
              <ChevronDown size={14} class="transition-transform {selectMenuOpen ? 'rotate-180' : ''}" />
            </button>
            {#if selectMenuOpen}
              <div class="absolute top-full left-0 right-0 mt-1 bg-surface rounded-lg shadow-lg border border-slate-200 py-1 z-10">
                <button
                  onclick={selectAll}
                  class="w-full px-4 py-2.5 text-sm text-left hover:bg-surface-tertiary transition-colors"
                >
                  Выбрать всё
                </button>
                <button
                  onclick={deselectAll}
                  class="w-full px-4 py-2.5 text-sm text-left hover:bg-surface-tertiary transition-colors"
                >
                  Снять выделение
                </button>
              </div>
            {/if}
          </div>

          <!-- Удаление -->
          <div class="relative flex-1 dropdown-container">
            <button
              onclick={(e) => {
                e.stopPropagation();
                deleteMenuOpen = !deleteMenuOpen;
                exportMenuOpen = false;
                selectMenuOpen = false;
              }}
              class="w-full px-4 py-2.5 text-sm font-medium rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors flex items-center justify-between gap-2"
            >
              <span class="flex items-center gap-2">
                <Trash2 size={16} />
                Удалить
              </span>
              <ChevronDown size={14} class="transition-transform {deleteMenuOpen ? 'rotate-180' : ''}" />
            </button>
            {#if deleteMenuOpen}
              <div class="absolute top-full left-0 right-0 mt-1 bg-surface rounded-lg shadow-lg border border-slate-200 py-1 z-10">
                <button
                  onclick={deleteSelected}
                  class="w-full px-4 py-2.5 text-sm text-left hover:bg-surface-tertiary transition-colors"
                  disabled={$selectedFileIds.size === 0}
                >
                  Удалить выбранные
                </button>
                <button
                  onclick={deleteAll}
                  class="w-full px-4 py-2.5 text-sm text-left hover:bg-surface-tertiary transition-colors"
                >
                  Удалить все
                </button>
              </div>
            {/if}
          </div>
          <!-- Загрузка файлов -->
          <div class="relative flex-1">
            <button
              onclick={() => fileInput.click()}
              class="w-full px-4 py-2.5 text-sm font-medium rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors flex items-center justify-center gap-2"
            >
              <Upload size={16} />
              Файлы
            </button>
          </div>

          <!-- Загрузка папки -->
          <div class="relative flex-1">
            <button
              onclick={() => folderInput.click()}
              class="w-full px-4 py-2.5 text-sm font-medium rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors flex items-center justify-center gap-2"
            >
              <FolderOpen size={16} />
              Папка
            </button>
          </div>
        </div>
      </div>

        <!-- Список файлов (Дроп-зона) -->
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
            {#each $attachedFiles as file, index (file.id)}
              <FileItem
                {file}
                {index}
                isSelected={$selectedFileIds.has(file.id)}
                allFiles={$attachedFiles}
                onToggleSelect={toggleSelect}
                onRemove={removeFile}
                onPreview={openPreview}
                onToggleExport={toggleExport}
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

<input
  bind:this={folderInput}
  type="file"
  multiple
  class="hidden"
  onchange={handleFolderInputChange}
  webkitdirectory
  directory
  mozdirectory
/>

<!-- Модальное окно предпросмотра -->
<FilePreviewModal file={previewFile} onClose={closePreview} />