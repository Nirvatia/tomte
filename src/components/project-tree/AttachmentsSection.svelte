<script lang="ts">
  import { dropzone } from "$lib/actions/dropzone";

  import {
    ChevronDown,
    ChevronRight,
    CircleAlert,
    FolderOpen,
    Paperclip,
    Trash2,
    Upload,
  } from "@lucide/svelte";

  import Checkbox from "../ui/Checkbox.svelte";
  import FileItem from "../attachments/FileItem.svelte";
  import FilePreviewModal from "../attachments/FilePreviewModal.svelte";

  import type { AttachedFile } from "../../types";

  import { requestConfirm } from "../../stores/confirm";
  import {
    attachedFiles,
    isFileManagerOpen,
    selectedFileIds,
    selectedFilesCount,
    totalFilesCount,
  } from "../../stores";

  import { getErrorMessage, pluralize } from "../../utils";
  import { processFile } from "../../utils/files";
  import {
    addAttachmentsToProject,
    removeAttachmentFromProject,
    removeAttachmentsFromProject,
  } from "../../utils/projectActions";

  import { SECTION_TOOL_BTN } from "./constants";

  interface Props {
    onInsertPlaceholder?: (file: AttachedFile) => void;
  }

  let { onInsertPlaceholder = () => {} }: Props = $props();

  let isAttachmentsSectionOpen = $state(true);
  let attachmentPreviewFile = $state<AttachedFile | null>(null);
  let attachmentFileInput = $state<HTMLInputElement | null>(null);
  let actionInProgress = $state(false);
  let errorMessage = $state<string | null>(null);

  const selectedAttachmentIds = $derived(
    new Set(
      $attachedFiles
        .filter((file) => $selectedFileIds.has(file.id))
        .map((file) => file.id),
    ),
  );

  const isAllAttachmentsSelected = $derived(
    $totalFilesCount > 0 && $selectedFilesCount === $totalFilesCount,
  );

  const isPartialAttachmentsSelected = $derived(
    $selectedFilesCount > 0 && $selectedFilesCount < $totalFilesCount,
  );

  async function handleAttachmentsFilesSelected(files: File[]) {
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

  function handleAttachmentFileInputChange(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      void handleAttachmentsFilesSelected(Array.from(input.files));
      input.value = "";
    }
  }

  function toggleAttachmentSelect(id: string) {
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

  async function removeAttachmentFile(id: string) {
    if (actionInProgress) return;
    actionInProgress = true;
    errorMessage = null;

    try {
      await removeAttachmentFromProject(id);
    } catch (error) {
      console.error("Failed to remove attachment:", error);
      errorMessage = getErrorMessage(error, "Не удалось удалить файл.");
    } finally {
      actionInProgress = false;
    }
  }

  function openAttachmentPreview(file: AttachedFile) {
    attachmentPreviewFile = file;
  }

  function closeAttachmentPreview() {
    attachmentPreviewFile = null;
  }

  function selectAllAttachments() {
    selectedFileIds.set(new Set($attachedFiles.map((f) => f.id)));
  }

  function deselectAllAttachments() {
    selectedFileIds.set(new Set());
  }

  function toggleSelectAllAttachments() {
    if (isAllAttachmentsSelected) {
      deselectAllAttachments();
    } else {
      selectAllAttachments();
    }
  }

  async function deleteSelectedAttachments() {
    if (actionInProgress) return;
    const idsToDelete = selectedAttachmentIds;
    if (idsToDelete.size === 0) return;

    const count = idsToDelete.size;
    const confirmed = await requestConfirm({
      title: "Удалить вложения?",
      message: `Будет удалено ${count} ${pluralize(count, "файл", "файла", "файлов")}.\nЭто действие нельзя отменить.`,
      confirmText: "Удалить",
      cancelText: "Отмена",
      danger: true,
    });

    if (!confirmed) return;

    actionInProgress = true;
    errorMessage = null;

    try {
      await removeAttachmentsFromProject(idsToDelete);
    } catch (error) {
      console.error("Failed to delete selected attachments:", error);
      errorMessage = getErrorMessage(
        error,
        "Не удалось удалить выбранные файлы.",
      );
    } finally {
      actionInProgress = false;
    }
  }
</script>

<div class="tree-section mb-1">
  <button
    type="button"
    onclick={() => (isAttachmentsSectionOpen = !isAttachmentsSectionOpen)}
    class="tree-section-header flex w-full items-center gap-1.5 px-4 py-1.5 text-[12px] font-semibold text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-light)]"
  >
    {#if isAttachmentsSectionOpen}
      <ChevronDown size={12} />
    {:else}
      <ChevronRight size={12} />
    {/if}
    <span>Attachments</span>
    <span class="ml-auto font-mono text-[10px] text-[var(--text-tertiary)]">
      {$totalFilesCount}
    </span>
  </button>

  {#if isAttachmentsSectionOpen}
    <div
      class="flex items-center gap-0.5 border-b border-[var(--border)] px-3 py-1.5"
    >
      <button
        type="button"
        onclick={() => attachmentFileInput?.click()}
        disabled={actionInProgress}
        class={SECTION_TOOL_BTN}
        title="Загрузить файлы"
        aria-label="Загрузить файлы"
      >
        <Upload size={16} />
      </button>
      <button
        type="button"
        onclick={() => isFileManagerOpen.set(true)}
        disabled={actionInProgress}
        class={SECTION_TOOL_BTN}
        title="Открыть менеджер файлов"
        aria-label="Открыть менеджер файлов"
      >
        <FolderOpen size={16} />
      </button>
      <div class="flex-1"></div>

      {#if $totalFilesCount > 0}
        {#if selectedAttachmentIds.size > 0}
          <button
            type="button"
            onclick={deleteSelectedAttachments}
            disabled={actionInProgress}
            class="flex h-7 cursor-pointer items-center gap-1 rounded px-2 text-[11px] font-medium text-[var(--error)] transition-colors hover:bg-[var(--error)]/10 disabled:pointer-events-none disabled:opacity-40"
            title="Удалить выбранные"
            aria-label="Удалить выбранные вложения"
          >
            <Trash2 size={14} />
            <span class="font-mono tabular-nums"
              >{selectedAttachmentIds.size}</span
            >
          </button>
        {/if}

        <div
          class="flex shrink-0 items-center gap-1.5"
          title="Выбрать все вложения"
        >
          <Checkbox
            checked={isAllAttachmentsSelected}
            indeterminate={isPartialAttachmentsSelected}
            onToggle={toggleSelectAllAttachments}
            ariaLabel="Выбрать все вложения"
          />
        </div>
      {/if}
    </div>

    {#if errorMessage}
      <div
        class="mx-3 mt-2 flex items-start gap-2 rounded-md border border-[var(--error)]/40 bg-[var(--error)]/10 px-3 py-2 text-xs text-[var(--error)]"
      >
        <CircleAlert size={14} class="mt-0.5 shrink-0" />
        <span>{errorMessage}</span>
      </div>
    {/if}

    <div
      use:dropzone={handleAttachmentsFilesSelected}
      class="relative min-h-0 transition-colors"
    >
      {#if $attachedFiles.length === 0}
        <div class="px-4 py-6 text-center">
          <Paperclip size={24} class="mx-auto mb-2 text-[var(--text-dim)]" />
          <p class="text-xs font-medium text-[var(--text-tertiary)]">
            Нет вложений
          </p>
          <p class="mt-1 text-[11px] leading-relaxed text-[var(--text-dim)]">
            Загрузите файлы или перетащите их сюда
          </p>
          <button
            type="button"
            onclick={() => attachmentFileInput?.click()}
            disabled={actionInProgress}
            class="mt-3 inline-flex items-center gap-1 rounded border border-[var(--border)] bg-[var(--bg-light)] px-2.5 py-1 text-[11px] text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-lighter)] hover:text-[var(--text-primary)] disabled:pointer-events-none disabled:opacity-40"
          >
            <Upload size={11} />
            Загрузить
          </button>
        </div>
      {:else}
        <div class="space-y-1.5 p-2">
          {#each $attachedFiles as file (file.id)}
            <FileItem
              {file}
              allFiles={$attachedFiles}
              isSelected={$selectedFileIds.has(file.id)}
              onToggleSelect={toggleAttachmentSelect}
              onRemove={removeAttachmentFile}
              onPreview={openAttachmentPreview}
              {onInsertPlaceholder}
            />
          {/each}
        </div>
      {/if}
    </div>
  {/if}

  <input
    bind:this={attachmentFileInput}
    type="file"
    multiple
    class="hidden"
    onchange={handleAttachmentFileInputChange}
    accept="image/*,.txt,.md,.py,.js,.html,.css,.json,.xml,.csv,.sql,.java,.cpp,.c,.h,.php,.rb,.go,.rs,.ts,.jsx,.tsx,.yaml,.yml,.svelte,.gd"
  />
</div>

<FilePreviewModal
  file={attachmentPreviewFile}
  onClose={closeAttachmentPreview}
/>
