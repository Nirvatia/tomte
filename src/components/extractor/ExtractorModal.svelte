<script lang="ts">
  import {
    Archive,
    Download,
    Eye,
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
  import { addAttachmentsToProject } from "../../utils/projectActions";

  let markdownInput = $state("");
  let extractedFiles = $state<ExtractedFile[]>([]);
  let previewFile = $state<ExtractedFile | null>(null);
  let editingIndex = $state<number | null>(null);
  let editName = $state("");

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
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "extracted_files.zip";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
    aria-label="Экстрактор кода"
    tabindex="-1"
  >
    <div
      class="flex h-[90vh] w-full max-w-5xl flex-col rounded-xl border border-[var(--border-light)] bg-[var(--bg-dark)] shadow-[var(--shadow-lg)]"
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
            Извлечение файлов из markdown-ответов LLM
          </p>
        </div>
        <button
          type="button"
          onclick={close}
          class="rounded-lg p-2 text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-lighter)] hover:text-[var(--text-primary)]"
          aria-label="Закрыть"
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
            Шаг 1 · Исходный текст
          </span>
          <button
            type="button"
            onclick={handleExtract}
            disabled={!markdownInput.trim()}
            class="inline-flex h-8 items-center gap-1.5 rounded-md bg-[var(--accent)] px-3 text-xs font-semibold text-[var(--bg-darkest)] transition-colors hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Распознать файлы
          </button>
        </div>
        <div class="flex min-h-0 flex-1 flex-col p-4">
          <textarea
            id="markdown-input"
            bind:value={markdownInput}
            placeholder="Вставьте сюда весь текст ответа LLM с code blocks..."
            class="min-h-0 w-full flex-1 resize-none rounded-lg border border-[var(--border)] bg-[var(--bg-darkest)] px-4 py-3 font-mono text-sm text-[var(--text-primary)] transition-all placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent)]/60 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/15"
            aria-label="Ответ LLM в формате Markdown"
          ></textarea>
        </div>
      </div>

      <div class="flex min-h-0 flex-1 flex-col border-t border-[var(--border)]">
        <div
          class="flex shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--bg-medium)] px-5 py-3"
        >
          <span
            class="font-mono text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]"
          >
            Шаг 2 · Распознанные файлы
            <span class="text-[var(--accent-hover)]"
              >({extractedFiles.length})</span
            >
          </span>
          {#if extractedFiles.length > 0}
            <div class="flex items-center gap-2">
              <button
                type="button"
                onclick={handleDownloadAll}
                class="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--bg-dark)] px-3 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-lighter)] hover:text-[var(--text-primary)]"
              >
                <Archive size={13} />
                Скачать ZIP
              </button>
              <button
                type="button"
                onclick={handleAddToAttachments}
                class="inline-flex h-8 items-center gap-1.5 rounded-md bg-[var(--accent)] px-3 text-xs font-semibold text-[var(--bg-darkest)] transition-colors hover:bg-[var(--accent-hover)]"
              >
                <Plus size={13} />
                Добавить в вложения
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
                Файлы пока не найдены
              </p>
              <p class="mt-1.5 max-w-md text-xs text-[var(--text-tertiary)]">
                Вставьте ответ LLM выше и нажмите «Распознать файлы» — блоки
                кода превратятся в отдельные файлы
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
                        class="w-full rounded border border-[var(--accent)]/60 bg-[var(--bg-darkest)] px-2 py-1 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20"
                      />
                    {:else}
                      <p
                        class="truncate text-sm font-medium text-[var(--text-primary)]"
                      >
                        {file.name}
                      </p>
                      <p class="mt-0.5 text-xs text-[var(--text-tertiary)]">
                        {file.code.length} символов
                      </p>
                    {/if}
                  </div>
                  <div
                    class="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    {#if editingIndex === index}
                      <button
                        type="button"
                        onclick={saveRename}
                        class="rounded-md p-1.5 text-[var(--success)] transition-colors hover:bg-[var(--success)]/10"
                        title="Сохранить"
                      >
                        <Plus size={16} />
                      </button>
                      <button
                        type="button"
                        onclick={cancelRename}
                        class="rounded-md p-1.5 text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-medium)] hover:text-[var(--text-primary)]"
                        title="Отмена"
                      >
                        <X size={16} />
                      </button>
                    {:else}
                      <button
                        type="button"
                        onclick={() => handlePreview(file)}
                        class="rounded-md p-1.5 text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-medium)] hover:text-[var(--text-primary)]"
                        title="Просмотр"
                      >
                        <Eye size={16} />
                      </button>
                      <button
                        type="button"
                        onclick={() => handleRename(index)}
                        class="rounded-md p-1.5 text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-medium)] hover:text-[var(--text-primary)]"
                        title="Переименовать"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        type="button"
                        onclick={() => handleDownload(index)}
                        class="rounded-md p-1.5 text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-medium)] hover:text-[var(--text-primary)]"
                        title="Скачать"
                      >
                        <Download size={16} />
                      </button>
                      <button
                        type="button"
                        onclick={() => handleRemove(index)}
                        class="rounded-md p-1.5 text-[var(--text-secondary)] transition-colors hover:bg-[var(--error)]/10 hover:text-[var(--error)]"
                        title="Удалить"
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
    aria-label="Предпросмотр файла {previewFile.name}"
    tabindex="-1"
  >
    <div
      class="flex max-h-[85vh] w-full max-w-4xl flex-col rounded-xl border border-[var(--border-light)] bg-[var(--bg-dark)] shadow-[var(--shadow-lg)]"
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
            · {previewFile.code.length} символов
          </p>
        </div>
        <button
          type="button"
          onclick={closePreview}
          class="rounded-lg p-2 text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-lighter)] hover:text-[var(--text-primary)]"
          aria-label="Закрыть предпросмотр"
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
