<script lang="ts">
  import { t } from "$lib/i18n";
  import { notifyUndo } from "$lib/notify";
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

  import { getErrorMessage } from "../../utils";
  import { processFile } from "../../utils/files";
  import {
    addAttachmentsToProject,
    pruneSelectedFileIds,
    removeAttachmentWithUndo,
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
      errorMessage = getErrorMessage(error, $t("attachments.errors.add"));
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
      const name =
        $attachedFiles.find((f) => f.id === id)?.name ??
        $t("attachments.fallbackName");
      const undo = await removeAttachmentWithUndo(id);
      if (undo) notifyUndo($t("attachments.deleted", { name }), undo);
      if (previewFile?.id === id) {
        previewFile = null;
      }
    } catch (error) {
      console.error("Failed to remove file:", error);
      errorMessage = getErrorMessage(error, $t("attachments.errors.delete"));
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
      title: $t("attachments.manager.deleteTitle"),
      message: $t("attachments.deleteMany.message", { count }),
      confirmText: $t("common.delete"),
      cancelText: $t("common.cancel"),
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
        $t("attachments.errors.deleteMany"),
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
    aria-label={$t("attachments.manager.title")}
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
            {$t("attachments.manager.title")}
          </h2>

          <p class="mt-1 text-sm text-[var(--text-tertiary)]">
            {$t("common.total")}
            <strong class="font-semibold text-[var(--text-primary)]">
              {$attachedFiles.length}
            </strong>

            {#if $selectedFilesCount > 0}
              <span class="ml-3 text-[var(--border-light)]">|</span>
              <span class="ml-3 font-medium text-[var(--accent-hover)]">
                {$t("common.selectedColon", { count: $selectedFilesCount })}
              </span>
            {/if}
          </p>
        </div>

        <button
          type="button"
          onclick={close}
          disabled={actionInProgress}
          class="rounded-lg p-2 text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-lighter)] hover:text-[var(--text-primary)] disabled:pointer-events-none disabled:opacity-40"
          aria-label={$t("attachments.manager.close")}
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
            {$t("attachments.manager.selectAll")}
          </button>

          <button
            type="button"
            onclick={deselectAll}
            disabled={actionInProgress}
            class="inline-flex flex-1 items-center justify-center gap-2 rounded-md border border-[var(--border)] bg-[var(--bg-dark)] px-4 py-2.5 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-lighter)] hover:text-[var(--text-primary)] disabled:pointer-events-none disabled:opacity-40"
          >
            <SquareX size={16} />
            {$t("common.deselect")}
          </button>

          <button
            type="button"
            onclick={deleteSelected}
            disabled={$selectedFilesCount === 0 || actionInProgress}
            class="inline-flex flex-1 items-center justify-center gap-2 rounded-md border border-[var(--error)]/40 bg-[var(--error)]/10 px-4 py-2.5 text-sm font-medium text-[var(--error)] transition-colors hover:bg-[var(--error)]/20 disabled:pointer-events-none disabled:opacity-40"
          >
            <Trash2 size={16} />
            {$t("prompts.deleteSelectedHint")}
          </button>

          <button
            type="button"
            onclick={() => fileInput?.click()}
            disabled={actionInProgress}
            class="inline-flex flex-1 items-center justify-center gap-2 rounded-md border border-[var(--success)]/30 bg-[var(--success)]/10 px-4 py-2.5 text-sm font-medium text-[var(--success)] transition-colors hover:bg-[var(--success)]/20 disabled:pointer-events-none disabled:opacity-40"
          >
            <Upload size={16} />
            {$t("attachments.uploadShort")}
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
              {$t("attachments.manager.empty")}
            </p>
            <p class="mt-2 text-sm text-[var(--text-tertiary)]">
              {$t("attachments.manager.emptyHint")}
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
