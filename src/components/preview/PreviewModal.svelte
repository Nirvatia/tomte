<script lang="ts">
  import { CircleAlert, FileText, Image as ImageIcon, X } from "@lucide/svelte";
  import { attachedFiles, isPreviewOpen } from "../../stores";
  import { buildPreviewHtml } from "../../utils/preview";

  interface Props {
    editorHtml?: string;
  }

  let { editorHtml = "" }: Props = $props();

  const previewData = $derived(buildPreviewHtml(editorHtml, $attachedFiles));

  function close() {
    isPreviewOpen.set(false);
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

  function stopEventPropagation(event: Event) {
    event.stopPropagation();
  }
</script>

<svelte:window onkeydown={handleWindowKeydown} />

{#if $isPreviewOpen}
  <div
    class="fixed inset-0 z-50 flex animate-fade-in items-center justify-center bg-black/60 p-4 backdrop-blur-[2px]"
    onclick={handleBackdropClick}
    onkeydown={handleBackdropKeydown}
    role="dialog"
    aria-modal="true"
    aria-label="Предпросмотр промпта"
    tabindex="-1"
  >
    <div
      class="flex max-h-[90vh] w-full max-w-5xl flex-col rounded-xl border border-[var(--border-light)] bg-[var(--bg-dark)] shadow-[var(--shadow-lg)]"
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
            <FileText size={24} class="text-[var(--accent)]" />
            Предпросмотр финального промпта
          </h2>
          <p class="mt-1 font-mono text-xs text-[var(--text-tertiary)]">
            Файлов:
            <strong class="font-semibold text-[var(--text-primary)]">
              {previewData.stats.totalFiles}
            </strong>
          </p>
        </div>
        <button
          type="button"
          onclick={close}
          class="rounded-lg p-2 text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-lighter)] hover:text-[var(--text-primary)]"
          aria-label="Закрыть предпросмотр"
        >
          <X size={20} />
        </button>
      </div>

      <div
        class="shrink-0 border-b border-[var(--border)] bg-[var(--bg-medium)] px-6 py-3"
      >
        <div class="flex flex-wrap gap-2">
          <div
            class="inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--bg-dark)] px-2.5 py-1.5 font-mono text-xs"
          >
            <ImageIcon size={13} class="text-[var(--accent-hover)]" />
            <span class="text-[var(--text-tertiary)]">
              Изображений использовано:
              <strong class="font-semibold text-[var(--text-primary)]">
                {previewData.stats.usedImages}
              </strong>
            </span>
          </div>

          {#if previewData.stats.unusedImages > 0}
            <div
              class="inline-flex items-center gap-1.5 rounded-md border border-[var(--warning)]/40 bg-[var(--warning)]/10 px-2.5 py-1.5 font-mono text-xs"
            >
              <CircleAlert size={13} class="text-[var(--warning)]" />
              <span class="text-[var(--text-tertiary)]">
                Без плейсхолдера:
                <strong class="font-semibold text-[var(--accent-hover)]">
                  {previewData.stats.unusedImages}
                </strong>
              </span>
            </div>
          {/if}

          <div
            class="inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--bg-dark)] px-2.5 py-1.5 font-mono text-xs"
          >
            <FileText size={13} class="text-[var(--success)]" />
            <span class="text-[var(--text-tertiary)]">
              Файлов использовано:
              <strong class="font-semibold text-[var(--text-primary)]">
                {previewData.stats.usedFiles}
              </strong>
            </span>
          </div>

          {#if previewData.stats.attachedTexts > 0}
            <div
              class="inline-flex items-center gap-1.5 rounded-md border border-[var(--success)]/30 bg-[var(--success)]/10 px-2.5 py-1.5 font-mono text-xs"
            >
              <FileText size={13} class="text-[var(--success)]" />
              <span class="text-[var(--text-tertiary)]">
                Прикреплено в конец:
                <strong class="font-semibold text-[var(--success)]">
                  {previewData.stats.attachedTexts}
                </strong>
              </span>
            </div>
          {/if}
        </div>
      </div>

      <div class="min-h-0 flex-1 overflow-y-auto p-6">
        {#if !editorHtml.trim() && previewData.stats.totalFiles === 0}
          <div
            class="flex h-full flex-col items-center justify-center py-16 text-center"
          >
            <FileText
              size={44}
              class="mb-3 text-[var(--text-tertiary)] opacity-40"
            />
            <p class="text-sm font-medium text-[var(--text-secondary)]">
              Нечего просматривать
            </p>
            <p class="mt-1.5 text-xs text-[var(--text-tertiary)]">
              Добавьте текст в редактор или загрузите файлы
            </p>
          </div>
        {:else}
          <div
            class="preview-content mx-auto max-w-4xl rounded-lg border border-[var(--border)] bg-[var(--bg-darkest)] p-8"
          >
            {@html previewData.html}
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}
