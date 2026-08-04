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
    class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in"
    role="button"
    tabindex="0"
    onclick={handleBackdropClick}
    onkeydown={handleBackdropKeydown}
    aria-label="Закрыть экстрактор кода"
  >
    <div
      class="bg-surface rounded-2xl shadow-2xl max-w-7xl w-full h-[90vh] flex flex-col"
      role="presentation"
      onclick={(e) => e.stopPropagation()}
    >
      <!-- Заголовок -->
      <div
        class="flex items-center justify-between p-6 border-b border-slate-100"
      >
        <div>
          <h2 class="text-xl font-bold text-ink flex items-center gap-2">
            <Plus size={24} class="text-purple-500" />
            Smart Code Extractor
          </h2>
          <p class="text-sm text-ink-tertiary mt-1">
            Извлечение файлов из markdown-ответов LLM
          </p>
        </div>
        <button
          type="button"
          onclick={close}
          class="p-2 rounded-lg hover:bg-surface-tertiary text-ink-secondary hover:text-ink transition-colors"
          aria-label="Закрыть"
        >
          <X size={20} />
        </button>
      </div>

      <!-- Основной контент -->
      <div class="flex-1 flex overflow-hidden">
        <!-- Левая панель -->
        <div class="flex-1 flex flex-col border-r border-slate-100">
          <div class="p-4 border-b border-slate-100 bg-surface-secondary">
            <label
              for="markdown-input"
              class="block text-sm font-medium text-ink mb-2"
              >Вставьте ответ LLM (Markdown):</label
            >
          </div>
          <div class="flex-1 p-4">
            <textarea
              id="markdown-input"
              bind:value={markdownInput}
              placeholder="Вставьте сюда весь текст ответа LLM с code blocks..."
              class="w-full h-full px-4 py-3 bg-surface-secondary border border-slate-200 rounded-lg text-sm text-ink font-mono focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 transition-all resize-none"
            ></textarea>
          </div>
          <div class="p-4 border-t border-slate-100 bg-surface-secondary">
            <button
              type="button"
              onclick={handleExtract}
              disabled={!markdownInput.trim()}
              class="w-full px-4 py-2.5 bg-purple-500 text-white rounded-lg font-medium hover:bg-purple-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              🔍 Распознать файлы
            </button>
          </div>
        </div>

        <!-- Правая панель -->
        <div class="flex-1 flex flex-col">
          <div class="p-4 border-b border-slate-100 bg-surface-secondary">
            <div class="flex items-center justify-between">
              <div>
                <h3 class="text-sm font-medium text-ink">Распознанные файлы</h3>
                <p class="text-xs text-ink-tertiary mt-0.5">
                  {extractedFiles.length} файл(ов)
                </p>
              </div>
              {#if extractedFiles.length > 0}
                <button
                  type="button"
                  onclick={handleAddToAttachments}
                  class="px-3 py-1.5 text-xs font-medium rounded-lg bg-brand-500 text-white hover:bg-brand-600 transition-colors"
                >
                  Добавить в вложения
                </button>
              {/if}
            </div>
          </div>

          <div class="flex-1 overflow-y-auto p-4">
            {#if extractedFiles.length === 0}
              <div class="text-center py-20 text-ink-tertiary">
                <Plus size={48} class="mx-auto mb-4 opacity-50" />
                <p class="text-lg">Файлы не найдены</p>
                <p class="text-sm mt-2">
                  Убедитесь, что текст содержит блоки кода в формате ```
                </p>
              </div>
            {:else}
              <div class="space-y-2">
                {#each extractedFiles as file, index (file.id)}
                  <div
                    class="group flex items-center gap-3 p-3 bg-surface-secondary rounded-xl border border-slate-100 hover:border-purple-200 hover:shadow-soft transition-all"
                  >
                    <div
                      class="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center shrink-0"
                    >
                      <span class="text-purple-600 text-xs font-bold"
                        >{file.lang.toUpperCase()}</span
                      >
                    </div>

                    <div class="flex-1 min-w-0">
                      {#if editingIndex === index}
                        <input
                          bind:value={editName}
                          onkeydown={(e) => {
                            if (e.key === "Enter") saveRename();
                            if (e.key === "Escape") cancelRename();
                          }}
                          class="w-full px-2 py-1 text-sm bg-surface border border-purple-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                        />
                      {:else}
                        <p class="text-sm font-medium text-ink truncate">
                          {file.name}
                        </p>
                        <p class="text-xs text-ink-tertiary mt-0.5">
                          {file.code.length} символов
                        </p>
                      {/if}
                    </div>

                    <div
                      class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      {#if editingIndex === index}
                        <button
                          type="button"
                          onclick={saveRename}
                          class="p-1.5 rounded-lg hover:bg-emerald-50 text-emerald-600 transition-colors"
                          title="Сохранить"><Plus size={16} /></button
                        >
                        <button
                          type="button"
                          onclick={cancelRename}
                          class="p-1.5 rounded-lg hover:bg-surface-tertiary text-ink-secondary transition-colors"
                          title="Отмена"><X size={16} /></button
                        >
                      {:else}
                        <button
                          type="button"
                          onclick={() => handlePreview(file)}
                          class="p-1.5 rounded-lg hover:bg-surface-tertiary text-ink-secondary hover:text-ink transition-colors"
                          title="Просмотр"><Eye size={16} /></button
                        >
                        <button
                          type="button"
                          onclick={() => handleRename(index)}
                          class="p-1.5 rounded-lg hover:bg-surface-tertiary text-ink-secondary hover:text-ink transition-colors"
                          title="Переименовать"><Pencil size={16} /></button
                        >
                        <button
                          type="button"
                          onclick={() => handleDownload(index)}
                          class="p-1.5 rounded-lg hover:bg-surface-tertiary text-ink-secondary hover:text-ink transition-colors"
                          title="Скачать"><Download size={16} /></button
                        >
                        <button
                          type="button"
                          onclick={() => handleRemove(index)}
                          class="p-1.5 rounded-lg hover:bg-red-50 text-ink-secondary hover:text-red-500 transition-colors"
                          title="Удалить"><Trash2 size={16} /></button
                        >
                      {/if}
                    </div>
                  </div>
                {/each}
              </div>
            {/if}
          </div>

          {#if extractedFiles.length > 0}
            <div class="p-4 border-t border-slate-100 bg-surface-secondary">
              <button
                type="button"
                onclick={handleDownloadAll}
                class="w-full px-4 py-2.5 bg-surface-tertiary text-ink rounded-lg font-medium hover:bg-slate-200 transition-colors flex items-center justify-center gap-2"
              >
                <Archive size={16} />
                Скачать все файлы (ZIP)
              </button>
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
    class="fixed inset-0 bg-black/70 backdrop-blur-sm z-60 flex items-center justify-center p-4 animate-fade-in"
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
      class="bg-surface rounded-2xl shadow-2xl max-w-4xl w-full max-h-[85vh] flex flex-col"
      role="presentation"
      onclick={(e) => e.stopPropagation()}
    >
      <div
        class="flex items-center justify-between p-6 border-b border-slate-100"
      >
        <div>
          <h3 class="text-lg font-bold text-ink">{previewFile.name}</h3>
          <p class="text-sm text-ink-tertiary mt-0.5">
            {previewFile.lang.toUpperCase()} · {previewFile.code.length} символов
          </p>
        </div>
        <button
          type="button"
          onclick={closePreview}
          class="p-2 rounded-lg hover:bg-surface-tertiary text-ink-secondary hover:text-ink transition-colors"
          aria-label="Закрыть предпросмотр"
        >
          <X size={20} />
        </button>
      </div>
      <div class="flex-1 overflow-auto p-6">
        <pre
          class="bg-surface-tertiary rounded-lg p-4 text-sm font-mono text-ink whitespace-pre-wrap overflow-x-auto">{previewFile.code}</pre>
      </div>
    </div>
  </div>
{/if}
