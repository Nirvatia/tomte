<script lang="ts">
  import { FileText, Image as ImageIcon, X } from "@lucide/svelte";

  import type { AttachedFile } from "../../types";

  interface Props {
    file?: AttachedFile | null;
    onClose?: () => void;
  }

  let { file = null, onClose = () => {} }: Props = $props();

  function handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      onClose();
    }
  }

function handleBackdropKeydown(event: KeyboardEvent) {
    if (!file) return;   
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
    }
    if (event.key === "Escape") {
      onClose();
    }
  }

  function preventEnterSpace(event: KeyboardEvent) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
    }
  }

  function stopEventPropagation(event: Event) {
    event.stopPropagation();
  }
</script>

<svelte:window onkeydown={handleBackdropKeydown} />

{#if file}
  <div
    class="fixed inset-0 z-50 flex animate-fade-in items-center justify-center bg-black/60 p-4 backdrop-blur-[2px]"
    onclick={handleBackdropClick}
    onkeydown={handleBackdropKeydown}
    role="dialog"
    aria-modal="true"
    aria-label="Просмотр файла {file.name}"
    tabindex="-1"
  >
    <div
      class="flex max-h-[85vh] w-full max-w-4xl flex-col rounded-xl border border-[var(--border-light)] bg-[var(--bg-dark)] shadow-[var(--shadow-lg)]"
      onclick={stopEventPropagation}
      onkeydown={preventEnterSpace}
      role="presentation"
    >
      <div
        class="flex items-center justify-between border-b border-[var(--border)] p-6"
      >
        <div class="flex items-center gap-3">
          {#if file.type === "image"}
            <div
              class="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--accent-dim)]"
            >
              <ImageIcon size={20} class="text-[var(--accent-hover)]" />
            </div>
          {:else}
            <div
              class="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--success)]/10"
            >
              <FileText size={20} class="text-[var(--success)]" />
            </div>
          {/if}

          <div>
            <h2 class="text-lg font-bold text-[var(--text-primary)]">
              {file.name}
            </h2>
            <p class="mt-0.5 font-mono text-xs text-[var(--text-tertiary)]">
              {file.type === "image" ? "Изображение" : "Текстовый файл"} ·
              {file.size.toLocaleString()} байт
            </p>
          </div>
        </div>

        <button
          type="button"
          onclick={onClose}
          class="rounded-lg p-2 text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-lighter)] hover:text-[var(--text-primary)]"
          aria-label="Закрыть просмотр файла"
        >
          <X size={20} />
        </button>
      </div>

      <div class="flex-1 overflow-auto p-6">
        {#if file.type === "image" && file.dataUrl}
          <div class="flex items-center justify-center">
            <img
              src={file.dataUrl}
              alt={file.name}
              class="max-h-[70vh] max-w-full rounded-lg border border-[var(--border-light)] shadow-[var(--shadow-lg)]"
            />
          </div>
        {:else if file.type === "text" && typeof file.content === "string"}
          <pre
            class="overflow-auto whitespace-pre-wrap rounded-lg border border-[var(--border)] bg-[var(--bg-darkest)] p-4 font-mono text-sm text-[var(--text-secondary)]">{file.content}</pre>
        {:else}
          <div class="py-20 text-center">
            <p class="text-sm font-medium text-[var(--text-secondary)]">
              Содержимое недоступно
            </p>
            <p
              class="mx-auto mt-2 max-w-md text-xs leading-relaxed text-[var(--text-tertiary)]"
            >
              Файл сохранён только как метаданные, либо содержимое не было
              загружено. Такое может произойти, если проект превысил лимит
              хранилища.
            </p>
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}
