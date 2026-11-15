<script lang="ts">
  import { t } from "$lib/i18n";
  import { downloadBlob } from "../../utils/export/common";
  import {
    Archive,
    Download,
    Eye,
    FolderOutput,
    Pencil,
    Plus,
    Trash2,
    X,
  } from "@lucide/svelte";

  import { isExtractorOpen } from "../../stores";
  import type { ExtractedFile } from "../../utils/extractor";
  import {
    convertToAttachedFile,
    createZipBlob,
    downloadFile,
    extractFilesFromMarkdown,
  } from "../../utils/extractor";
  import { isFolderWriteSupported } from "../../utils/fileWriter";
  import { addAttachmentsToProject } from "../../utils/projectActions";
  import ApplyToFolderModal from "./ApplyToFolderModal.svelte";

  let markdownInput = $state("");
  let extractedFiles = $state<ExtractedFile[]>([]);
  let previewFile = $state<ExtractedFile | null>(null);
  let editingIndex = $state<number | null>(null);
  let editName = $state("");
  let applyOpen = $state(false);

  function close() {
    isExtractorOpen.set(false);
  }

  function handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      close();
    }
  }

  function handleBackdropKeydown(event: KeyboardEvent) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
    }
    if (event.key === "Escape") {
      close();
    }
  }

  function handleWindowKeydown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      close();
    }
  }

  function handleExtract() {
    if (!markdownInput.trim()) return;
    extractedFiles = extractFilesFromMarkdown(markdownInput);
  }

  function handleRename(index: number) {
    editingIndex = index;
    editName = extractedFiles[index].name;
  }

  function saveRename() {
    if (editingIndex !== null && editName.trim()) {
      extractedFiles[editingIndex].name = editName.trim();
      extractedFiles = [...extractedFiles];
    }
    editingIndex = null;
    editName = "";
  }

  function cancelRename() {
    editingIndex = null;
    editName = "";
  }

  function handleRemove(index: number) {
    extractedFiles = extractedFiles.filter((_, i) => i !== index);
  }

  function handleDownload(index: number) {
    downloadFile(extractedFiles[index].code, extractedFiles[index].name);
  }

  function handleDownloadAll() {
    const blob = createZipBlob(extractedFiles);
    downloadBlob(blob, "extracted_files.zip");
  }

  async function handleAddToAttachments() {
    const newFiles = extractedFiles.map(convertToAttachedFile);
    await addAttachmentsToProject(newFiles);
    close();
  }

  function handlePreview(file: ExtractedFile) {
    previewFile = file;
  }

  function closePreview() {
    previewFile = null;
  }

  function handlePreviewBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      closePreview();
    }
  }

  function handlePreviewBackdropKeydown(event: KeyboardEvent) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
    }
    if (event.key === "Escape") {
      closePreview();
    }
  }

  function stopEventPropagation(event: Event) {
    event.stopPropagation();
  }
</script>

<svelte:window onkeydown={handleWindowKeydown} />

{#if $isExtractorOpen}
  <div
    class="fixed inset-0 z-50 flex animate-fade-in items-center justify-center bg-black/60 p-4 backdrop-blur-[2px]"
    onclick={handleBackdropClick}
    onkeydown={handleBackdropKeydown}
    role="dialog"
    aria-modal="true"
    aria-label={$t("extractor.dialog")}
    tabindex="-1"
  >
    <div
      class="flex h-[90vh] w-full max-w-5xl flex-col rounded-lg border border-[var(--border-light)] bg-[var(--bg-medium)] shadow-lg"
      role="presentation"
      onclick={stopEventPropagation}
      onkeydown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
        }
      }}
    >
      <div
        class="flex shrink-0 items-center justify-between border-b border-[var(--border)] p-6"
      >
        <div>
          <h2
            class="flex items-center gap-2 text-xl font-bold text-[var(--text-primary)]"
          >
            <Plus size={24} class="text-[var(--accent)]" />
            Smart Code Extractor
          </h2>
          <p class="mt-1 text-sm text-[var(--text-tertiary)]">
            {$t("extractor.subtitle")}
          </p>
        </div>
        <button
          type="button"
          onclick={close}
          class="icon-btn"
          aria-label={$t("common.close")}
        >
          <X size={20} />
        </button>
      </div>

      <div class="flex min-h-0 flex-1 flex-col">
        <div
          class="flex shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--bg-medium)] px-5 py-3"
        >
          <span
            class="font-mono text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]"
          >
            {$t("extractor.step1")}
          </span>
          <button
            type="button"
            onclick={handleExtract}
            disabled={!markdownInput.trim()}
            class="btn btn-primary btn-sm"
          >
            {$t("extractor.parse")}
          </button>
        </div>
        <div class="flex min-h-0 flex-1 flex-col p-4">
          <textarea
            id="markdown-input"
            bind:value={markdownInput}
            placeholder={$t("extractor.inputPlaceholder")}
            class="input min-h-0 w-full flex-1 resize-none px-4 py-3 font-mono"
            aria-label={$t("extractor.input")}></textarea>
        </div>
      </div>

      <div class="flex min-h-0 flex-1 flex-col border-t border-[var(--border)]">
        <div
          class="flex shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--bg-medium)] px-5 py-3"
        >
          <span
            class="font-mono text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]"
          >
            {$t("extractor.step2")}
            <span class="text-[var(--accent-hover)]"
              >({extractedFiles.length})</span
            >
          </span>
          {#if extractedFiles.length > 0}
            <div class="flex items-center gap-2">
              <button
                type="button"
                onclick={handleDownloadAll}
                class="btn btn-outline btn-sm"
              >
                <Archive size={13} />
                {$t("extractor.downloadZip")}
              </button>
              <!-- Этап 10.5: запись в папку (File System Access API). -->
              {#if isFolderWriteSupported()}
                <button
                  type="button"
                  onclick={() => (applyOpen = true)}
                  class="btn btn-outline btn-sm"
                >
                  <FolderOutput size={13} />
                  {$t("extractor.apply")}
                </button>
              {/if}
              <button
                type="button"
                onclick={handleAddToAttachments}
                class="btn btn-primary btn-sm"
              >
                <Plus size={13} />
                {$t("extractor.addToAttachments")}
              </button>
            </div>
          {/if}
        </div>
        <div class="min-h-0 flex-1 overflow-y-auto p-4">
          {#if extractedFiles.length === 0}
            <div
              class="flex h-full flex-col items-center justify-center py-10 text-center"
            >
              <Plus
                size={40}
                class="mb-3 text-[var(--text-tertiary)] opacity-40"
              />
              <p class="text-sm font-medium text-[var(--text-secondary)]">
                {$t("extractor.empty")}
              </p>
              <p class="mt-1.5 max-w-md text-xs text-[var(--text-tertiary)]">
                {$t("extractor.emptyHint")}
              </p>
            </div>
          {:else}
            <div class="space-y-2">
              {#each extractedFiles as file, index (file.id)}
                <div
                  class="group flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--bg-medium)] p-3 transition-all hover:border-[var(--border-light)] hover:bg-[var(--bg-lighter)]"
                >
                  <div
                    class="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--bg-darkest)]"
                  >
                    <span
                      class="font-mono text-xs font-bold text-[var(--accent-hover)]"
                    >
                      {file.lang.toUpperCase()}
                    </span>
                  </div>
                  <div class="min-w-0 flex-1">
                    {#if editingIndex === index}
                      <input
                        bind:value={editName}
                        onkeydown={(event) => {
                          event.stopPropagation();
                          if (event.key === "Enter") saveRename();
                          if (event.key === "Escape") cancelRename();
                        }}
                        class="input w-full px-2 py-1"
                      />
                    {:else}
                      <p
                        class="truncate text-sm font-medium text-[var(--text-primary)]"
                      >
                        {file.name}
                      </p>
                      <p class="mt-0.5 text-xs text-[var(--text-tertiary)]">
                        {$t("common.chars", { count: file.code.length })}
                      </p>
                    {/if}
                  </div>
                  <div
                    class="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
                  >
                    {#if editingIndex === index}
                      <button
                        type="button"
                        onclick={saveRename}
                        class="icon-btn text-[var(--success)] hover:bg-[var(--success)]/10"
                        title={$t("common.save")}
                      >
                        <Plus size={16} />
                      </button>
                      <button
                        type="button"
                        onclick={cancelRename}
                        class="icon-btn"
                        title={$t("common.cancel")}
                      >
                        <X size={16} />
                      </button>
                    {:else}
                      <button
                        type="button"
                        onclick={() => handlePreview(file)}
                        class="icon-btn"
                        title={$t("common.view")}
                      >
                        <Eye size={16} />
                      </button>
                      <button
                        type="button"
                        onclick={() => handleRename(index)}
                        class="icon-btn"
                        title={$t("common.rename")}
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        type="button"
                        onclick={() => handleDownload(index)}
                        class="icon-btn"
                        title={$t("common.download")}
                      >
                        <Download size={16} />
                      </button>
                      <button
                        type="button"
                        onclick={() => handleRemove(index)}
                        class="icon-btn danger"
                        title={$t("common.delete")}
                      >
                        <Trash2 size={16} />
                      </button>
                    {/if}
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      </div>
    </div>
  </div>
{/if}

{#if previewFile}
  <div
    class="fixed inset-0 z-60 flex animate-fade-in items-center justify-center bg-black/70 p-4 backdrop-blur-[2px]"
    onclick={handlePreviewBackdropClick}
    onkeydown={handlePreviewBackdropKeydown}
    role="dialog"
    aria-modal="true"
    aria-label={$t("extractor.previewFile", { name: previewFile.name })}
    tabindex="-1"
  >
    <div
      class="flex max-h-[85vh] w-full max-w-4xl flex-col rounded-lg border border-[var(--border-light)] bg-[var(--bg-medium)] shadow-lg"
      role="presentation"
      onclick={stopEventPropagation}
      onkeydown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
        }
      }}
    >
      <div
        class="flex items-center justify-between border-b border-[var(--border)] p-6"
      >
        <div>
          <h3 class="text-lg font-bold text-[var(--text-primary)]">
            {previewFile.name}
          </h3>
          <p class="mt-0.5 font-mono text-xs text-[var(--text-tertiary)]">
            <span class="font-semibold text-[var(--accent-hover)]">
              {previewFile.lang.toUpperCase()}
            </span>
            · {$t("common.chars", { count: previewFile.code.length })}
          </p>
        </div>
        <button
          type="button"
          onclick={closePreview}
          class="icon-btn"
          aria-label={$t("extractor.closePreview")}
        >
          <X size={20} />
        </button>
      </div>
      <div class="min-h-0 flex-1 overflow-auto p-6">
        <pre
          class="overflow-auto whitespace-pre-wrap rounded-lg border border-[var(--border)] bg-[var(--bg-darkest)] p-4 font-mono text-sm text-[var(--text-secondary)]">
          {previewFile.code}
        </pre>
      </div>
    </div>
  </div>
{/if}

{#if applyOpen}
  <ApplyToFolderModal
    files={extractedFiles}
    onClose={() => (applyOpen = false)}
  />
{/if}
