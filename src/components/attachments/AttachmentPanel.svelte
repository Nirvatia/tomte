<script lang="ts">
  import {
    attachedFiles,
    selectedFileIds,
    isFileManagerOpen,
    totalFilesCount,
    selectedFilesCount,
  } from "../../stores";
  import {
    FolderOpen,
    CheckSquare,
    XSquare,
    Trash2,
    Upload,
  } from "@lucide/svelte";
  import { dropzone } from "$lib/actions/dropzone";
  import FileItem from "./FileItem.svelte";
  import FilePreviewModal from "./FilePreviewModal.svelte";
  import type { AttachedFile } from "../../types";
  import { processFile } from "../../utils/files";

  let {
    editor = null,
    onInsertPlaceholder = (file: AttachedFile) => {},
  }: {
    editor?: any;
    onInsertPlaceholder?: (file: AttachedFile) => void;
  } = $props();

  let previewFile: AttachedFile | null = $state(null);
  let fileInput: HTMLInputElement;

  async function handleFilesSelected(files: File[]) {
    for (const file of files) {
      try {
        const attachedFile = await processFile(file);
        attachedFiles.update(($files) => [...$files, attachedFile]);
      } catch (error) {
        console.error("Error processing file:", error);
      }
    }
  }

  function handleFileInputChange(e: Event) {
    const input = e.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      handleFilesSelected(Array.from(input.files));
      input.value = "";
    }
  }

  function toggleSelect(id: string) {
    selectedFileIds.update(($selected) => {
      const newSet = new Set($selected);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
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
    selectedFileIds.set(new Set($attachedFiles.map((f) => f.id)));
  }
  function deselectAll() {
    selectedFileIds.set(new Set());
  }

  function deleteSelected() {
    if ($selectedFileIds.size === 0) return;
    if (!confirm(`Удалить ${$selectedFileIds.size} файл(ов)?`)) return;
    attachedFiles.update(($files) =>
      $files.filter((f) => !$selectedFileIds.has(f.id)),
    );
    selectedFileIds.set(new Set());
  }
</script>

<div
  class="w-100 shrink-0 flex flex-col bg-surface border-l border-slate-200 overflow-hidden h-full"
>
  <div class="p-4 border-b border-slate-100 bg-surface-secondary shrink-0">
    <div class="flex items-center justify-between mb-3">
      <h2 class="font-bold text-ink flex items-center gap-2">
        <FolderOpen size={18} class="text-brand-500" />
        Вложения
      </h2>
      <div class="flex items-center gap-2 text-xs">
        <span class="text-ink-tertiary"
          ><strong class="text-ink">{$totalFilesCount}</strong></span
        >
        {#if $selectedFilesCount > 0}
          <span class="text-slate-300">|</span>
          <span class="text-brand-600 font-medium">✓ {$selectedFilesCount}</span
          >
        {/if}
      </div>
    </div>

    <div class="flex gap-2 mb-3">
      <button
        type="button"
        onclick={selectAll}
        class="flex-1 px-3 py-2 text-xs font-medium rounded-lg bg-surface-tertiary hover:bg-slate-200 transition-colors flex items-center justify-center gap-1.5"
      >
        <CheckSquare size={14} /> Выбрать всё
      </button>
      <button
        type="button"
        onclick={deselectAll}
        class="flex-1 px-3 py-2 text-xs font-medium rounded-lg bg-surface-tertiary hover:bg-slate-200 transition-colors flex items-center justify-center gap-1.5"
      >
        <XSquare size={14} /> Снять
      </button>
      <button
        type="button"
        onclick={deleteSelected}
        class="flex-1 px-3 py-2 text-xs font-medium rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors flex items-center justify-center gap-1.5"
        disabled={$selectedFilesCount === 0}
      >
        <Trash2 size={14} /> Удалить
      </button>
    </div>

    <div class="flex gap-2">
      <button
        type="button"
        onclick={() => fileInput.click()}
        class="flex-1 py-2 px-3 bg-surface-tertiary text-ink rounded-lg font-medium text-sm hover:bg-slate-200 transition-colors flex items-center justify-center gap-2 border border-slate-200"
      >
        <Upload size={16} /> Загрузить
      </button>
      <button
        type="button"
        onclick={() => isFileManagerOpen.set(true)}
        class="flex-1 py-2 px-3 bg-brand-500 text-white rounded-lg font-medium text-sm hover:bg-brand-600 transition-colors flex items-center justify-center gap-2"
      >
        <FolderOpen size={16} /> Менеджер
      </button>
    </div>

    <input
      bind:this={fileInput}
      type="file"
      multiple
      class="hidden"
      onchange={handleFileInputChange}
      accept="image/*,.txt,.md,.py,.js,.html,.css,.json,.xml,.csv,.sql,.java,.cpp,.c,.h,.php,.rb,.go,.rs,.ts,.jsx,.tsx,.yaml,.yml,.svelte,.gd"
    />
  </div>

  <!-- Здесь магия: одна строка заменяет 3 функции и кучу обработчиков -->
  <div
    use:dropzone={handleFilesSelected}
    class="flex-1 overflow-y-auto p-4 space-y-2 min-h-0 relative transition-colors"
  >
    {#if $attachedFiles.length === 0}
      <div class="text-center py-10 text-ink-tertiary">
        <FolderOpen size={32} class="mx-auto mb-3 opacity-50" />
        <p class="text-sm">Нет загруженных файлов</p>
        <p class="text-xs mt-1">Нажмите «Загрузить» или перетащите их сюда</p>
      </div>
    {:else}
      {#each $attachedFiles as file (file.id)}
        <FileItem
          {file}
          allFiles={$attachedFiles}
          isSelected={$selectedFileIds.has(file.id)}
          onToggleSelect={toggleSelect}
          onRemove={removeFile}
          onPreview={openPreview}
          {onInsertPlaceholder}
        />
      {/each}
    {/if}
  </div>
</div>

<FilePreviewModal file={previewFile} onClose={closePreview} />
