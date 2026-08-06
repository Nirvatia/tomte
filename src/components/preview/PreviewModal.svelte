<!-- PreviewModal.svelte -->
<script lang="ts">
  import { attachedFiles, isPreviewOpen } from "../../stores";
  import { X, FileText, Image as ImageIcon, CircleAlert } from "@lucide/svelte";
  import { buildPreviewHtml } from "../../utils/preview";
  let { editorHtml = "" }: { editorHtml?: string } = $props();
  let previewData = $derived(buildPreviewHtml(editorHtml, $attachedFiles));
  function close() {
    isPreviewOpen.set(false);
  }
  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      close();
    }
  }
  function handleBackdropKeydown(e: KeyboardEvent) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      close();
    }
  }
  function handleWindowKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      close();
    }
  }
</script>

<svelte:window onkeydown={handleWindowKeydown} />

{#if $isPreviewOpen}
  <div
    class="fixed inset-0 z-50 flex animate-fade-in items-center justify-center bg-black/60 p-4 backdrop-blur-[2px]"
    role="button"
    tabindex="0"
    onclick={handleBackdropClick}
    onkeydown={handleBackdropKeydown}
    aria-label="Закрыть предпросмотр"
  >
    <div
      class="flex max-h-[90vh] w-full max-w-5xl flex-col rounded-xl border border-line2 bg-panel shadow-deep"
      role="presentation"
      onclick={(e) => e.stopPropagation()}
    >
      <!-- Заголовок -->
      <div
        class="flex shrink-0 items-center justify-between border-b border-line p-6"
      >
        <div>
          <h2 class="flex items-center gap-2 text-xl font-bold text-txt">
            <FileText size={24} class="text-amb" />
            Предпросмотр финального промпта
          </h2>
          <p class="mt-1 font-mono text-xs text-txt3">
            Файлов:
            <strong class="font-semibold text-txt"
              >{previewData.stats.totalFiles}</strong
            >
          </p>
        </div>
        <button
          type="button"
          onclick={close}
          class="rounded-lg p-2 text-txt2 transition-colors hover:bg-raised2 hover:text-txt"
          aria-label="Закрыть предпросмотр"
        >
          <X size={20} />
        </button>
      </div>

      <!-- Статистика -->
      <div class="shrink-0 border-b border-line bg-raised px-6 py-3">
        <div class="flex flex-wrap gap-2">
          <div
            class="inline-flex items-center gap-1.5 rounded-md border border-line bg-panel px-2.5 py-1.5 font-mono text-xs"
          >
            <ImageIcon size={13} class="text-amb2" />
            <span class="text-txt3"
              >Изображений использовано:
              <strong class="font-semibold text-txt"
                >{previewData.stats.usedImages}</strong
              ></span
            >
          </div>

          {#if previewData.stats.unusedImages > 0}
            <div
              class="inline-flex items-center gap-1.5 rounded-md border border-amb/40 bg-amb/10 px-2.5 py-1.5 font-mono text-xs"
            >
              <CircleAlert size={13} class="text-amb" />
              <span class="text-txt3"
                >Без плейсхолдера:
                <strong class="font-semibold text-amb2"
                  >{previewData.stats.unusedImages}</strong
                ></span
              >
            </div>
          {/if}

          <div
            class="inline-flex items-center gap-1.5 rounded-md border border-line bg-panel px-2.5 py-1.5 font-mono text-xs"
          >
            <FileText size={13} class="text-ok" />
            <span class="text-txt3"
              >Файлов использовано:
              <strong class="font-semibold text-txt"
                >{previewData.stats.usedFiles}</strong
              ></span
            >
          </div>

          {#if previewData.stats.attachedTexts > 0}
            <div
              class="inline-flex items-center gap-1.5 rounded-md border border-ok/30 bg-ok/10 px-2.5 py-1.5 font-mono text-xs"
            >
              <FileText size={13} class="text-ok" />
              <span class="text-txt3"
                >Прикреплено в конец:
                <strong class="font-semibold text-ok"
                  >{previewData.stats.attachedTexts}</strong
                ></span
              >
            </div>
          {/if}
        </div>
      </div>

      <!-- Содержимое -->
      <div class="min-h-0 flex-1 overflow-y-auto p-6">
        {#if !editorHtml.trim() && previewData.stats.totalFiles === 0}
          <div
            class="flex h-full flex-col items-center justify-center py-16 text-center"
          >
            <FileText size={44} class="mb-3 text-txt3 opacity-40" />
            <p class="text-sm font-medium text-txt2">Нечего просматривать</p>
            <p class="mt-1.5 text-xs text-txt3">
              Добавьте текст в редактор или загрузите файлы
            </p>
          </div>
        {:else}
          <div
            class="preview-content mx-auto max-w-4xl rounded-lg border border-line bg-inset p-8"
          >
            {@html previewData.html}
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}