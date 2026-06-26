<script lang="ts">
  import { X, FileText, Image as ImageIcon } from '@lucide/svelte';
  import type { AttachedFile } from '../../types';

  let { file = null, onClose = () => {} }: { file?: AttachedFile | null; onClose?: () => void } =
    $props();

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      onClose();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if file}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in"
    onclick={handleBackdropClick}
  >
    <div class="bg-surface rounded-2xl shadow-2xl max-w-4xl w-full max-h-[85vh] flex flex-col">
      <!-- Заголовок -->
      <div class="flex items-center justify-between p-6 border-b border-slate-100">
        <div class="flex items-center gap-3">
          {#if file.type === 'image'}
            <div class="w-10 h-10 rounded-lg bg-brand-50 flex items-center justify-center">
              <ImageIcon size={20} class="text-brand-600" />
            </div>
          {:else}
            <div class="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
              <FileText size={20} class="text-emerald-600" />
            </div>
          {/if}
          <div>
            <h2 class="text-lg font-bold text-ink">{file.name}</h2>
            <p class="text-xs text-ink-tertiary mt-0.5">
              {file.type === 'image' ? 'Изображение' : 'Текстовый файл'} · {file.size.toLocaleString()} байт
            </p>
          </div>
        </div>
        <button
          onclick={onClose}
          class="p-2 rounded-lg hover:bg-surface-tertiary text-ink-secondary hover:text-ink transition-colors"
          aria-label="Закрыть"
        >
          <X size={20} />
        </button>
      </div>

      <!-- Содержимое -->
      <div class="flex-1 overflow-auto p-6">
        {#if file.type === 'image' && file.dataUrl}
          <div class="flex items-center justify-center">
            <img
              src={file.dataUrl}
              alt={file.name}
              class="max-w-full max-h-[70vh] rounded-lg shadow-lg"
            />
          </div>
        {:else if file.type === 'text' && file.content}
          <pre class="bg-surface-tertiary rounded-lg p-4 overflow-auto text-sm font-mono text-ink whitespace-pre-wrap">{file.content}</pre>
        {:else}
          <div class="text-center py-20 text-ink-tertiary">
            <p>Не удалось загрузить содержимое файла</p>
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}