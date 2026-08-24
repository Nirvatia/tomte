<script lang="ts">
  import {
    CircleAlert,
    FolderOpen,
    SquareCheck,
    SquareX,
    Trash2,
    Upload,
    X,
  } from "@lucide/svelte";

  import FileItem from "./FileItem.svelte";
  import FilePreviewModal from "./FilePreviewModal.svelte";

  import type { AttachedFile } from "../../types";

  import { dropzone } from "$lib/actions/dropzone";

  import {
    attachedFiles,
    isFileManagerOpen,
    selectedFileIds,
    selectedFilesCount,
  } from "../../stores";
  import { requestConfirm } from "../../stores/confirm";

  import { getErrorMessage, pluralize } from "../../utils";
  import { processFile } from "../../utils/files";
  import {
    addAttachmentsToProject,
    pruneSelectedFileIds,
    removeAttachmentFromProject,
    removeSelectedAttachmentsFromProject,
  } from "../../utils/projectActions";

  let previewFile = $state<AttachedFile | null>(null);
  let fileInput = $state<HTMLInputElement | null>(null);
  let actionInProgress = $state(false);
  let errorMessage = $state<string | null>(null);

  $effect(() => {
    if (!$isFileManagerOpen) {
      previewFile = null;
      errorMessage = null;
      actionInProgress = false;
    }
  });

  $effect(() => {
    if ($isFileManagerOpen) {
      pruneSelectedFileIds();
      errorMessage = null;
    }
  });

  async function handleFilesSelected(files: File[]) {
    if (actionInProgress || files.length === 0) return;

    actionInProgress = true;
    errorMessage = null;

    try {
      const processedFiles: AttachedFile[] = [];
      for (const file of files) {
        processedFiles.push(await processFile(file));
      }

      if (processedFiles.length > 0) {
        await addAttachmentsToProject(processedFiles);
      }
    } catch (error) {
      console.error("Failed to add attachments:", error);
      errorMessage = getErrorMessage(error, "Не удалось добавить файлы.");
    } finally {
      actionInProgress = false;
    }
  }

  function handleFileInputChange(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      void handleFilesSelected(Array.from(input.files));
      input.value = "";
    }
  }

  function close() {
    if (actionInProgress) return;
    previewFile = null;
    errorMessage = null;
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

  async function removeFile(id: string) {
    if (actionInProgress) return;

    actionInProgress = true;
    errorMessage = null;

    try {
      await removeAttachmentFromProject(id);
      if (previewFile?.id === id) {
        previewFile = null;
      }
    } catch (error) {
      console.error("Failed to remove file:", error);
      errorMessage = getErrorMessage(error, "Не удалось удалить файл.");
    } finally {
      actionInProgress = false;
    }
  }

  function openPreview(file: AttachedFile) {
    previewFile = file;
  }

  function closePreview() {
    previewFile = null;
  }

  function selectAll() {
    selectedFileIds.set(new Set($attachedFiles.map((file) => file.id)));
  }

  function deselectAll() {
    selectedFileIds.set(new Set());
  }

  async function deleteSelected() {
    if (actionInProgress) return;
    if ($selectedFilesCount === 0) return;

    const count = $selectedFilesCount;
    const confirmed = await requestConfirm({
      title: "Удалить выбранные файлы?",
      message: `Будет удалено ${count} ${pluralize(count, "файл", "файла", "файлов")}.\nЭто действие нельзя отменить.`,
      confirmText: "Удалить",
      cancelText: "Отмена",
      danger: true,
    });

    if (!confirmed) return;

    actionInProgress = true;
    errorMessage = null;

    try {
      const deletedCount = await removeSelectedAttachmentsFromProject();
      if (previewFile && deletedCount > 0) {
        const stillExists = $attachedFiles.some(
          (file) => file.id === previewFile?.id,
        );
        if (!stillExists) {
          previewFile = null;
        }
      }
    } catch (error) {
      console.error("Failed to delete selected files:", error);
      errorMessage = getErrorMessage(
        error,
        "Не удалось удалить выбранные файлы.",
      );
    } finally {
      actionInProgress = false;
    }
  }

  function handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      close();
    }
  }

  function handleWindowKeydown(event: KeyboardEvent) {
    if (!$isFileManagerOpen) return;
    if (event.key === "Escape" && !previewFile) {
      close();
    }
  }

  function preventEnterSpace(event: KeyboardEvent) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
    }
  }

  function stopEventPropagation(event: Event) {
    event.stopPropagation();
  }
</script>

<svelte:window onkeydown={handleWindowKeydown} />

{#if $isFileManagerOpen}
  <div
    class="fixed inset-0 z-50 flex animate-fade-in items-center justify-center bg-black/60 p-4 backdrop-blur-[2px]"
    onclick={handleBackdropClick}
    onkeydown={preventEnterSpace}
    role="dialog"
    aria-modal="true"
    aria-label="Менеджер файлов"
    tabindex="-1"
  >
    <div
      class="flex max-h-[90vh] w-full max-w-6xl flex-col rounded-xl border border-[var(--border-light)] bg-[var(--bg-dark)] shadow-[var(--shadow-lg)]"
      role="presentation"
      onclick={stopEventPropagation}
      onkeydown={preventEnterSpace}
    >
      <div
        class="flex items-center justify-between border-b border-[var(--border)] p-6"
      >
        <div>
          <h2
            class="flex items-center gap-2 text-xl font-bold text-[var(--text-primary)]"
          >
            <FolderOpen size={24} class="text-[var(--accent)]" />
            Менеджер файлов
          </h2>

          <p class="mt-1 text-sm text-[var(--text-tertiary)]">
            Всего:
            <strong class="font-semibold text-[var(--text-primary)]">
              {$attachedFiles.length}
            </strong>

            {#if $selectedFilesCount > 0}
              <span class="ml-3 text-[var(--border-light)]">|</span>
              <span class="ml-3 font-medium text-[var(--accent-hover)]">
                Выбрано: {$selectedFilesCount}
              </span>
            {/if}
          </p>
        </div>

        <button
          type="button"
          onclick={close}
          disabled={actionInProgress}
          class="rounded-lg p-2 text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-lighter)] hover:text-[var(--text-primary)] disabled:pointer-events-none disabled:opacity-40"
          aria-label="Закрыть менеджер файлов"
        >
          <X size={20} />
        </button>
      </div>

      <div
        class="border-b border-[var(--border)] bg-[var(--bg-medium)] px-6 py-4"
      >
        <div class="flex gap-2">
          <button
            type="button"
            onclick={selectAll}
            disabled={actionInProgress}
            class="inline-flex flex-1 items-center justify-center gap-2 rounded-md border border-[var(--border)] bg-[var(--bg-dark)] px-4 py-2.5 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-lighter)] hover:text-[var(--text-primary)] disabled:pointer-events-none disabled:opacity-40"
          >
            <SquareCheck size={16} />
            Выбрать всё
          </button>

          <button
            type="button"
            onclick={deselectAll}
            disabled={actionInProgress}
            class="inline-flex flex-1 items-center justify-center gap-2 rounded-md border border-[var(--border)] bg-[var(--bg-dark)] px-4 py-2.5 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-lighter)] hover:text-[var(--text-primary)] disabled:pointer-events-none disabled:opacity-40"
          >
            <SquareX size={16} />
            Снять выделение
          </button>

          <button
            type="button"
            onclick={deleteSelected}
            disabled={$selectedFilesCount === 0 || actionInProgress}
            class="inline-flex flex-1 items-center justify-center gap-2 rounded-md border border-[var(--error)]/40 bg-[var(--error)]/10 px-4 py-2.5 text-sm font-medium text-[var(--error)] transition-colors hover:bg-[var(--error)]/20 disabled:pointer-events-none disabled:opacity-40"
          >
            <Trash2 size={16} />
            Удалить выбранные
          </button>

          <button
            type="button"
            onclick={() => fileInput?.click()}
            disabled={actionInProgress}
            class="inline-flex flex-1 items-center justify-center gap-2 rounded-md border border-[var(--success)]/30 bg-[var(--success)]/10 px-4 py-2.5 text-sm font-medium text-[var(--success)] transition-colors hover:bg-[var(--success)]/20 disabled:pointer-events-none disabled:opacity-40"
          >
            <Upload size={16} />
            Загрузить
          </button>
        </div>

        {#if errorMessage}
          <div
            class="mt-3 flex items-start gap-2 rounded-md border border-[var(--error)]/40 bg-[var(--error)]/10 px-3 py-2 text-xs text-[var(--error)]"
          >
            <CircleAlert size={14} class="mt-0.5 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        {/if}
      </div>

      <div
        use:dropzone={handleFilesSelected}
        class="relative min-h-0 flex-1 overflow-y-auto p-6 transition-colors"
      >
        {#if $attachedFiles.length === 0}
          <div class="py-20 text-center">
            <FolderOpen
              size={48}
              class="mx-auto mb-4 text-[var(--text-tertiary)] opacity-40"
            />
            <p class="text-lg font-medium text-[var(--text-secondary)]">
              Нет загруженных файлов
            </p>
            <p class="mt-2 text-sm text-[var(--text-tertiary)]">
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
