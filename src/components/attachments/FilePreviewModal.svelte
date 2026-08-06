<!-- FilePreviewModal.svelte -->
<script lang="ts">
  import { X, FileText, Image as ImageIcon } from "@lucide/svelte";
  import type { AttachedFile } from "../../types";
  let {
    file = null,
    onClose = () => {},
  }: { file?: AttachedFile | null; onClose?: () => void } = $props();
  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }
  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      onClose();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if file}
  <div
    class="fixed inset-0 z-50 flex animate-fade-in items-center justify-center bg-black/60 p-4 backdrop-blur-[2px]"
    onclick={handleBackdropClick}
    onkeydown={handleKeydown}
    role="dialog"
    aria-modal="true"
    aria-label="Просмотр файла {file.name}"
    tabindex="-1"
  >
    <div
      class="flex max-h-[85vh] w-full max-w-4xl flex-col rounded-xl border border-line2 bg-panel shadow-deep"
    >
      <!-- Заголовок -->
      <div class="flex items-center justify-between border-b border-line p-6">
        <div class="flex items-center gap-3">
          {#if file.type === "image"}
            <div
              class="flex h-10 w-10 items-center justify-center rounded-lg bg-amb/10"
            >
              <ImageIcon size={20} class="text-amb2" />
            </div>
          {:else}
            <div
              class="flex h-10 w-10 items-center justify-center rounded-lg bg-ok/10"
            >
              <FileText size={20} class="text-ok" />
            </div>
          {/if}
          <div>
            <h2 class="text-lg font-bold text-txt">{file.name}</h2>
            <p class="mt-0.5 font-mono text-xs text-txt3">
              {file.type === "image" ? "Изображение" : "Текстовый файл"} ·
              {file.size.toLocaleString()} байт
            </p>
          </div>
        </div>
        <button
          type="button"
          onclick={onClose}
          class="rounded-lg p-2 text-txt2 transition-colors hover:bg-raised2 hover:text-txt"
          aria-label="Закрыть просмотр файла"
        >
          <X size={20} />
        </button>
      </div>

      <!-- Содержимое -->
      <div class="flex-1 overflow-auto p-6">
        {#if file.type === "image" && file.dataUrl}
          <div class="flex items-center justify-center">
            <img
              src={file.dataUrl}
              alt={file.name}
              class="max-h-[70vh] max-w-full rounded-lg border border-line2 shadow-deep"
            />
          </div>
        {:else if file.type === "text" && file.content}
          <pre
            class="overflow-auto whitespace-pre-wrap rounded-lg border border-line bg-inset p-4 font-mono text-sm text-txt2">{file.content}</pre>
        {:else}
          <div class="py-20 text-center text-txt3">
            <p>Не удалось загрузить содержимое файла</p>
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}
