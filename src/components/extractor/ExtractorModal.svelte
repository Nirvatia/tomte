<!-- ExtractorModal.svelte -->
<script lang="ts">
  import {
    X,
    Download,
    Eye,
    Pencil,
    Trash2,
    Plus,
    Archive,
  } from "@lucide/svelte";
  import { isExtractorOpen, attachedFiles } from "../../stores";
  import type { ExtractedFile } from "../../utils/extractor";
  import {
    extractFilesFromMarkdown,
    convertToAttachedFile,
    downloadFile,
    createZipBlob,
  } from "../../utils/extractor";
  let markdownInput = $state("");
  let extractedFiles = $state<ExtractedFile[]>([]);
  let previewFile = $state<ExtractedFile | null>(null);
  let editingIndex = $state<number | null>(null);
  let editName = $state("");
  function close() {
    isExtractorOpen.set(false);
  }
  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) close();
  }
  function handleBackdropKeydown(e: KeyboardEvent) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      close();
    }
  }
  function handleWindowKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") close();
  }
  function handleExtract() {
    if (!markdownInput.trim()) {
      console.warn("⚠️ Поле ввода пустое или содержит только пробелы");
      return;
    }
    console.log("🚀 Запуск распознавания...");
    const result = extractFilesFromMarkdown(markdownInput);
    console.log("📦 Результат:", result);
    // В Svelte 5 переназначение $state массива корректно триггерит обновление UI
    extractedFiles = result;
  }
  function handleRename(index: number) {
    editingIndex = index;
    editName = extractedFiles[index].name;
  }
  function saveRename() {
    if (editingIndex !== null && editName.trim()) {
      extractedFiles[editingIndex].name = editName.trim();
      extractedFiles = [...extractedFiles]; // Триггер реактивности
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
  function handleAddToAttachments() {
    const newFiles = extractedFiles.map(convertToAttachedFile);
    attachedFiles.update((files) => [...files, ...newFiles]);
    close();
  }
  function handlePreview(file: ExtractedFile) {
    previewFile = file;
  }
  function closePreview() {
    previewFile = null;
  }
</script>

<svelte:window onkeydown={handleWindowKeydown} />

{#if $isExtractorOpen}
  <div
    class="fixed inset-0 z-50 flex animate-fade-in items-center justify-center bg-black/60 p-4 backdrop-blur-[2px]"
    role="button"
    tabindex="0"
    onclick={handleBackdropClick}
    onkeydown={handleBackdropKeydown}
    aria-label="Закрыть экстрактор кода"
  >
    <div
      class="flex h-[90vh] w-full max-w-5xl flex-col rounded-xl border border-line2 bg-panel shadow-deep"
      role="presentation"
      onclick={(e) => e.stopPropagation()}
    >
      <!-- Заголовок -->
      <div
        class="flex shrink-0 items-center justify-between border-b border-line p-6"
      >
        <div>
          <h2 class="flex items-center gap-2 text-xl font-bold text-txt">
            <Plus size={24} class="text-amb" />
            Smart Code Extractor
          </h2>
          <p class="mt-1 text-sm text-txt3">
            Извлечение файлов из markdown-ответов LLM
          </p>
        </div>
        <button
          type="button"
          onclick={close}
          class="rounded-lg p-2 text-txt2 transition-colors hover:bg-raised2 hover:text-txt"
          aria-label="Закрыть"
        >
          <X size={20} />
        </button>
      </div>

      <!-- Шаг 1: исходный текст -->
      <div class="flex min-h-0 flex-1 flex-col">
        <div
          class="flex shrink-0 items-center justify-between border-b border-line bg-raised px-5 py-3"
        >
          <span
            class="font-mono text-[11px] font-semibold uppercase tracking-wider text-txt3"
            >Шаг 1 · Исходный текст</span
          >
          <button
            type="button"
            onclick={handleExtract}
            disabled={!markdownInput.trim()}
            class="inline-flex h-8 items-center gap-1.5 rounded-md bg-amb px-3 text-xs font-semibold text-[#16130c] transition-colors hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Распознать файлы
          </button>
        </div>
        <div class="flex min-h-0 flex-1 flex-col p-4">
          <textarea
            id="markdown-input"
            bind:value={markdownInput}
            placeholder="Вставьте сюда весь текст ответа LLM с code blocks..."
            class="min-h-0 w-full flex-1 resize-none rounded-lg border border-line bg-inset px-4 py-3 font-mono text-sm text-txt transition-all placeholder:text-txt3 focus:border-amb/60 focus:outline-none focus:ring-2 focus:ring-amb/15"
            aria-label="Ответ LLM в формате Markdown"
          ></textarea>
        </div>
      </div>

      <!-- Шаг 2: результат -->
      <div class="flex min-h-0 flex-1 flex-col border-t border-line">
        <div
          class="flex shrink-0 items-center justify-between border-b border-line bg-raised px-5 py-3"
        >
          <span
            class="font-mono text-[11px] font-semibold uppercase tracking-wider text-txt3"
            >Шаг 2 · Распознанные файлы
            <span class="text-amb2">({extractedFiles.length})</span></span
          >
          {#if extractedFiles.length > 0}
            <div class="flex items-center gap-2">
              <button
                type="button"
                onclick={handleDownloadAll}
                class="inline-flex h-8 items-center gap-1.5 rounded-md border border-line bg-panel px-3 text-xs font-medium text-txt2 transition-colors hover:bg-raised2 hover:text-txt"
              >
                <Archive size={13} />
                Скачать ZIP
              </button>
              <button
                type="button"
                onclick={handleAddToAttachments}
                class="inline-flex h-8 items-center gap-1.5 rounded-md bg-amb px-3 text-xs font-semibold text-[#16130c] transition-colors hover:brightness-105"
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
              <Plus size={40} class="mb-3 text-txt3 opacity-40" />
              <p class="text-sm font-medium text-txt2">Файлы пока не найдены</p>
              <p class="mt-1.5 max-w-md text-xs text-txt3">
                Вставьте ответ LLM выше и нажмите «Распознать файлы» — блоки
                кода ``` превратятся в отдельные файлы
              </p>
            </div>
          {:else}
            <div class="space-y-2">
              {#each extractedFiles as file, index (file.id)}
                <div
                  class="group flex items-center gap-3 rounded-lg border border-line bg-raised p-3 transition-all hover:border-line2 hover:bg-raised2"
                >
                  <div
                    class="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-line bg-inset"
                  >
                    <span class="font-mono text-xs font-bold text-amb2"
                      >{file.lang.toUpperCase()}</span
                    >
                  </div>
                  <div class="min-w-0 flex-1">
                    {#if editingIndex === index}
                      <input
                        bind:value={editName}
                        onkeydown={(e) => {
                          if (e.key === "Enter") saveRename();
                          if (e.key === "Escape") cancelRename();
                        }}
                        class="w-full rounded border border-amb/60 bg-inset px-2 py-1 text-sm text-txt focus:outline-none focus:ring-2 focus:ring-amb/20"
                      />
                    {:else}
                      <p class="truncate text-sm font-medium text-txt">
                        {file.name}
                      </p>
                      <p class="mt-0.5 text-xs text-txt3">
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
                        class="rounded-md p-1.5 text-ok transition-colors hover:bg-ok/10"
                        title="Сохранить"><Plus size={16} /></button
                      >
                      <button
                        type="button"
                        onclick={cancelRename}
                        class="rounded-md p-1.5 text-txt2 transition-colors hover:bg-raised hover:text-txt"
                        title="Отмена"><X size={16} /></button
                      >
                    {:else}
                      <button
                        type="button"
                        onclick={() => handlePreview(file)}
                        class="rounded-md p-1.5 text-txt2 transition-colors hover:bg-raised hover:text-txt"
                        title="Просмотр"><Eye size={16} /></button
                      >
                      <button
                        type="button"
                        onclick={() => handleRename(index)}
                        class="rounded-md p-1.5 text-txt2 transition-colors hover:bg-raised hover:text-txt"
                        title="Переименовать"><Pencil size={16} /></button
                      >
                      <button
                        type="button"
                        onclick={() => handleDownload(index)}
                        class="rounded-md p-1.5 text-txt2 transition-colors hover:bg-raised hover:text-txt"
                        title="Скачать"><Download size={16} /></button
                      >
                      <button
                        type="button"
                        onclick={() => handleRemove(index)}
                        class="rounded-md p-1.5 text-txt2 transition-colors hover:bg-red-50 hover:text-red-600"
                        title="Удалить"><Trash2 size={16} /></button
                      >
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

<!-- Превью файла -->
{#if previewFile}
  <div
    class="fixed inset-0 z-60 flex animate-fade-in items-center justify-center bg-black/70 p-4 backdrop-blur-[2px]"
    role="button"
    tabindex="0"
    onclick={(e) => {
      if (e.target === e.currentTarget) closePreview();
    }}
    onkeydown={(e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        closePreview();
      }
    }}
    aria-label="Закрыть предпросмотр файла"
  >
    <div
      class="flex max-h-[85vh] w-full max-w-4xl flex-col rounded-xl border border-line2 bg-panel shadow-deep"
      role="presentation"
      onclick={(e) => e.stopPropagation()}
    >
      <div class="flex items-center justify-between border-b border-line p-6">
        <div>
          <h3 class="text-lg font-bold text-txt">{previewFile.name}</h3>
          <p class="mt-0.5 font-mono text-xs text-txt3">
            <span class="font-semibold text-amb2"
              >{previewFile.lang.toUpperCase()}</span
            >
            · {previewFile.code.length} символов
          </p>
        </div>
        <button
          type="button"
          onclick={closePreview}
          class="rounded-lg p-2 text-txt2 transition-colors hover:bg-raised2 hover:text-txt"
          aria-label="Закрыть предпросмотр"
        >
          <X size={20} />
        </button>
      </div>
      <div class="min-h-0 flex-1 overflow-auto p-6">
        <pre
          class="overflow-auto whitespace-pre-wrap rounded-lg border border-line bg-inset p-4 font-mono text-sm text-txt2">{previewFile.code}</pre>
      </div>
    </div>
  </div>
{/if}
