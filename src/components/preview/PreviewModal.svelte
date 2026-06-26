<script lang="ts">
  import { attachedFiles, isPreviewOpen } from '../../stores';
  import { X, FileText, Image as ImageIcon, AlertCircle } from '@lucide/svelte';
  import { buildPreviewHtml } from '../../utils/preview';

  let { editorHtml = '' }: { editorHtml?: string } = $props();

  let previewData = $derived(buildPreviewHtml(editorHtml, $attachedFiles));

  function close() {
    isPreviewOpen.set(false);
  }

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      close();
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      close();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if $isPreviewOpen}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in"
    onclick={handleBackdropClick}
  >
    <div class="bg-surface rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] flex flex-col">
      <!-- Заголовок -->
      <div class="flex items-center justify-between p-6 border-b border-slate-100">
        <div>
          <h2 class="text-xl font-bold text-ink flex items-center gap-2">
            <FileText size={24} class="text-brand-500" />
            Предпросмотр финального промпта
          </h2>
          <p class="text-sm text-ink-tertiary mt-1">
            Файлов: <strong class="text-ink">{previewData.stats.totalFiles}</strong>
          </p>
        </div>
        <button
          onclick={close}
          class="p-2 rounded-lg hover:bg-surface-tertiary text-ink-secondary hover:text-ink transition-colors"
          aria-label="Закрыть"
        >
          <X size={20} />
        </button>
      </div>

      <!-- Статистика -->
      <div class="px-6 py-3 border-b border-slate-100 bg-surface-secondary">
        <div class="flex flex-wrap gap-4 text-xs">
          <div class="flex items-center gap-2">
            <ImageIcon size={14} class="text-brand-500" />
            <span class="text-ink-tertiary">
              Изображений использовано: <strong class="text-ink">{previewData.stats.usedImages}</strong>
            </span>
          </div>
          {#if previewData.stats.unusedImages > 0}
            <div class="flex items-center gap-2">
              <AlertCircle size={14} class="text-amber-500" />
              <span class="text-ink-tertiary">
                Без плейсхолдера: <strong class="text-amber-600">{previewData.stats.unusedImages}</strong>
              </span>
            </div>
          {/if}
          <div class="flex items-center gap-2">
            <FileText size={14} class="text-emerald-500" />
            <span class="text-ink-tertiary">
              Файлов использовано: <strong class="text-ink">{previewData.stats.usedFiles}</strong>
            </span>
          </div>
          {#if previewData.stats.attachedTexts > 0}
            <div class="flex items-center gap-2">
              <FileText size={14} class="text-emerald-500" />
              <span class="text-ink-tertiary">
                Прикреплено в конец: <strong class="text-emerald-600">{previewData.stats.attachedTexts}</strong>
              </span>
            </div>
          {/if}
        </div>
      </div>

      <!-- Содержимое -->
      <div class="flex-1 overflow-y-auto p-6">
        {#if !editorHtml.trim() && previewData.stats.totalFiles === 0}
          <div class="text-center py-20 text-ink-tertiary">
            <FileText size={48} class="mx-auto mb-4 opacity-50" />
            <p class="text-lg">Нечего просматривать</p>
            <p class="text-sm mt-2">Добавьте текст в редактор или загрузите файлы</p>
          </div>
        {:else}
          <div class="preview-content prose max-w-none">
            {@html previewData.html}
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}