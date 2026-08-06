<!-- AttachmentPanel.svelte -->
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
    SquareCheck,
    SquareX,
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
  class="flex h-full w-100 shrink-0 flex-col overflow-hidden border-l border-line bg-panel"
>
  <!-- Шапка: название + счётчик + менеджер -->
  <div class="shrink-0 border-b border-line bg-raised p-4">
    <div class="flex items-center justify-between">
      <h2 class="flex items-center gap-2 font-bold text-txt">
        <FolderOpen size={18} class="text-amb" />
        Вложения
      </h2>
      <div class="flex items-center gap-2.5">
        <div class="flex items-center gap-2 font-mono text-xs">
          <span class="text-txt3"
            ><strong class="font-semibold text-txt">{$totalFilesCount}</strong
            ></span
          >
          {#if $selectedFilesCount > 0}
            <span class="text-line2">|</span>
            <span class="font-semibold text-amb2">✓ {$selectedFilesCount}</span>
          {/if}
        </div>
        <button
          type="button"
          onclick={() => isFileManagerOpen.set(true)}
          class="inline-flex items-center gap-1.5 rounded-md border border-line bg-panel px-2.5 py-1.5 text-xs font-medium text-txt2 transition-colors hover:bg-raised2 hover:text-txt"
          title="Открыть менеджер файлов"
        >
          <FolderOpen size={13} />
          Менеджер
        </button>
      </div>
    </div>
  </div>

  <!-- Список файлов -->
  <div
    use:dropzone={handleFilesSelected}
    class="relative min-h-0 flex-1 space-y-2 overflow-y-auto p-3 transition-colors"
  >
    {#if $attachedFiles.length === 0}
      <div class="py-12 text-center">
        <FolderOpen size={32} class="mx-auto mb-3 text-txt3 opacity-40" />
        <p class="text-sm font-medium text-txt2">Нет загруженных файлов</p>
        <p class="mt-1 text-xs text-txt3">
          Нажмите «Загрузить» или перетащите их сюда
        </p>
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

  <!-- Футер: выбор + загрузка -->
  <div class="shrink-0 space-y-2.5 border-t border-line bg-raised p-3">
    {#if $attachedFiles.length > 0}
      <div class="flex items-center justify-between">
        <span class="font-mono text-xs text-txt3">
          {#if $selectedFilesCount > 0}
            Выбрано:
            <span class="font-semibold text-amb2">{$selectedFilesCount}</span>
          {:else}
            Выбор файлов
          {/if}
        </span>
        <div class="flex items-center gap-1.5">
          <button
            type="button"
            onclick={selectAll}
            class="inline-flex h-8 items-center gap-1 rounded-md border border-line bg-panel px-2.5 text-xs font-medium text-txt2 transition-colors hover:bg-raised2 hover:text-txt"
            title="Выбрать все файлы"
          >
            <SquareCheck size={13} /> Все
          </button>
          <button
            type="button"
            onclick={deselectAll}
            class="inline-flex h-8 items-center gap-1 rounded-md border border-line bg-panel px-2.5 text-xs font-medium text-txt2 transition-colors hover:bg-raised2 hover:text-txt"
            title="Снять выделение"
          >
            <SquareX size={13} /> Снять
          </button>
          <button
            type="button"
            onclick={deleteSelected}
            class="inline-flex h-8 items-center gap-1 rounded-md border border-red-200/60 bg-red-50 px-2.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50/70 disabled:pointer-events-none disabled:opacity-40"
            disabled={$selectedFilesCount === 0}
            title="Удалить выбранные файлы"
          >
            <Trash2 size={13} /> Удалить
          </button>
        </div>
      </div>
    {/if}

    <button
      type="button"
      onclick={() => fileInput.click()}
      class="inline-flex w-full items-center justify-center gap-2 rounded-md bg-amb px-4 py-2.5 font-mono text-xs font-bold uppercase tracking-wider text-[#16130c] transition-colors hover:brightness-105"
    >
      <Upload size={15} /> Загрузить файлы
    </button>

    <input
      bind:this={fileInput}
      type="file"
      multiple
      class="hidden"
      onchange={handleFileInputChange}
      accept="image/*,.txt,.md,.py,.js,.html,.css,.json,.xml,.csv,.sql,.java,.cpp,.c,.h,.php,.rb,.go,.rs,.ts,.jsx,.tsx,.yaml,.yml,.svelte,.gd"
    />
  </div>
</div>

<FilePreviewModal file={previewFile} onClose={closePreview} />
