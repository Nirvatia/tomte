<!-- FileManagerModal.svelte -->
<script lang="ts">
  import {
    X,
    FolderOpen,
    Trash2,
    SquareCheck,
    SquareX,
    Upload,
  } from "@lucide/svelte";
  import { dropzone } from "$lib/actions/dropzone";
  import FileItem from "./FileItem.svelte";
  import FilePreviewModal from "./FilePreviewModal.svelte";
  import type { AttachedFile } from "../../types";
  import { processFile } from "../../utils/files";
  import { get } from "svelte/store";
  import {
    attachedFiles,
    selectedFileIds,
    isFileManagerOpen,
  } from "../../stores";
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
  function close() {
    isFileManagerOpen.set(false);
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
    selectedFileIds.set(new Set(get(attachedFiles).map((f) => f.id)));
  }
  function deselectAll() {
    selectedFileIds.set(new Set());
  }
  function deleteSelected() {
    const selectedIds = get(selectedFileIds);
    if (selectedIds.size === 0) return;
    if (!confirm(`Удалить ${selectedIds.size} файл(ов)?`)) return;
    attachedFiles.update(($files) =>
      $files.filter((f) => !selectedIds.has(f.id)),
    );
    selectedFileIds.set(new Set());
  }
  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) close();
  }
  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") close();
  }
</script>

{#if $isFileManagerOpen}
  <div
    class="fixed inset-0 z-50 flex animate-fade-in items-center justify-center bg-black/60 p-4 backdrop-blur-[2px]"
    onclick={handleBackdropClick}
    onkeydown={handleKeydown}
    role="dialog"
    aria-modal="true"
    aria-label="Менеджер файлов"
    tabindex="-1"
  >
    <div
      class="flex max-h-[90vh] w-full max-w-6xl flex-col rounded-xl border border-line2 bg-panel shadow-deep"
    >
      <!-- Заголовок -->
      <div class="flex items-center justify-between border-b border-line p-6">
        <div>
          <h2 class="flex items-center gap-2 text-xl font-bold text-txt">
            <FolderOpen size={24} class="text-amb" />
            Менеджер файлов
          </h2>
          <p class="mt-1 text-sm text-txt3">
            Всего: <strong class="font-semibold text-txt"
              >{$attachedFiles.length}</strong
            >
            {#if $selectedFileIds.size > 0}
              <span class="ml-3 text-line2">|</span>
              <span class="ml-3 font-medium text-amb2"
                >Выбрано: {$selectedFileIds.size}</span
              >
            {/if}
          </p>
        </div>
        <button
          type="button"
          onclick={close}
          class="rounded-lg p-2 text-txt2 transition-colors hover:bg-raised2 hover:text-txt"
          aria-label="Закрыть менеджер файлов"
        >
          <X size={20} />
        </button>
      </div>

      <!-- Панель инструментов -->
      <div class="border-b border-line bg-raised px-6 py-4">
        <div class="flex gap-2">
          <button
            type="button"
            onclick={selectAll}
            class="inline-flex flex-1 items-center justify-center gap-2 rounded-md border border-line bg-panel px-4 py-2.5 text-sm font-medium text-txt2 transition-colors hover:bg-raised2 hover:text-txt"
          >
            <SquareCheck size={16} />
            Выбрать всё
          </button>
          <button
            type="button"
            onclick={deselectAll}
            class="inline-flex flex-1 items-center justify-center gap-2 rounded-md border border-line bg-panel px-4 py-2.5 text-sm font-medium text-txt2 transition-colors hover:bg-raised2 hover:text-txt"
          >
            <SquareX size={16} />
            Снять выделение
          </button>
          <button
            type="button"
            onclick={deleteSelected}
            class="inline-flex flex-1 items-center justify-center gap-2 rounded-md border border-red-200/60 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50/70 disabled:pointer-events-none disabled:opacity-40"
            disabled={$selectedFileIds.size === 0}
          >
            <Trash2 size={16} />
            Удалить выбранные
          </button>
          <button
            type="button"
            onclick={() => fileInput.click()}
            class="inline-flex flex-1 items-center justify-center gap-2 rounded-md border border-ok/30 bg-ok/10 px-4 py-2.5 text-sm font-medium text-ok transition-colors hover:bg-ok/20"
          >
            <Upload size={16} />
            Загрузить
          </button>
        </div>
      </div>

      <!-- Список файлов -->
      <div
        use:dropzone={handleFilesSelected}
        class="relative min-h-0 flex-1 overflow-y-auto p-6 transition-colors"
      >
        {#if $attachedFiles.length === 0}
          <div class="py-20 text-center">
            <FolderOpen size={48} class="mx-auto mb-4 text-txt3 opacity-40" />
            <p class="text-lg font-medium text-txt2">Нет загруженных файлов</p>
            <p class="mt-2 text-sm text-txt3">
              Закройте это окно и загрузите файлы в правом сайдбаре
            </p>
          </div>
        {:else}
          <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
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
