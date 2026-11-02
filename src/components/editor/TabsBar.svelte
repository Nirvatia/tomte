<script lang="ts">
  import { FileText, Plus, X } from "@lucide/svelte";
  import { autofocus } from "$lib/actions/autofocus";
  import type { PromptFile } from "../../types";
  import {
    activeFileId,
    openFileIds,
    previewFileId,
    promptFiles,
  } from "../../stores";
  import {
    activatePromptFile,
    closePromptFileTab,
    createPromptFile,
  } from "../../utils/projectActions";

  let newFileName = $state("");
  let isCreatingFile = $state(false);
  let actionInProgress = $state(false);
  let tabsContainer = $state<HTMLDivElement | null>(null);

  const displayFiles = $derived.by(() => {
    const pinned = $openFileIds
      .map((id) => $promptFiles.find((f) => f.id === id))
      .filter((f): f is PromptFile => f !== undefined);
    if ($previewFileId && !$openFileIds.includes($previewFileId)) {
      const previewFile = $promptFiles.find((f) => f.id === $previewFileId);
      if (previewFile) {
        return [...pinned, previewFile];
      }
    }
    return pinned;
  });

  function isPreviewTab(fileId: string): boolean {
    return fileId === $previewFileId && !$openFileIds.includes(fileId);
  }

  function suggestNewFileName(): string {
    const names = new Set($promptFiles.map((f) => f.name.toLowerCase()));
    let counter = 1;
    let candidate = `prompt-${counter}`;
    while (names.has(candidate.toLowerCase())) {
      counter += 1;
      candidate = `prompt-${counter}`;
    }
    return candidate;
  }

  // Вертикальное колёсико мыши прокручивает табы по горизонтали.
  // preventDefault не вызываем намеренно: все предки контейнера
  // имеют overflow-hidden, поэтому вертикальная прокрутка страницы
  // не пострадает, а обработчик работает и с passive-слушателем.
  function handleWheel(event: WheelEvent) {
    const el = tabsContainer;
    if (!el || el.scrollWidth <= el.clientWidth) return;
    // Горизонтальный свайп тачпада отдаём нативной прокрутке
    if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
    let delta = event.deltaY;
    if (event.deltaMode === 1) {
      delta *= 16; // строки -> пиксели (Firefox)
    } else if (event.deltaMode === 2) {
      delta *= el.clientWidth; // страницы -> пиксели
    }
    el.scrollLeft += delta;
  }

  function handleSelectFile(fileId: string) {
    void activatePromptFile(fileId);
  }

  function handleCloseFile(event: MouseEvent, fileId: string) {
    event.stopPropagation();
    void closePromptFileTab(fileId);
  }

  function handleCreateNewFile() {
    if (actionInProgress || isCreatingFile) return;
    isCreatingFile = true;
    newFileName = suggestNewFileName();
  }

  async function saveNewFile() {
    if (actionInProgress) return;
    if (!newFileName.trim()) {
      cancelNewFile();
      return;
    }
    actionInProgress = true;
    try {
      await createPromptFile(newFileName.trim());
      cancelNewFile();
    } finally {
      actionInProgress = false;
    }
  }

  function cancelNewFile() {
    isCreatingFile = false;
    newFileName = "";
  }

  function handleTabKeydown(event: KeyboardEvent, fileId: string) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleSelectFile(fileId);
    }
  }
</script>

<div
  bind:this={tabsContainer}
  onwheel={handleWheel}
  class="tabsbar-scroll flex h-[40px] shrink-0 items-end overflow-x-auto border-b border-[var(--border)] bg-[var(--bg-dark)]"
  role="tablist"
  aria-label="Файлы промптов"
>
  {#each displayFiles as file (file.id)}
    {@const isActive = $activeFileId === file.id}
    <div
      class="group flex h-[39px] cursor-pointer items-center gap-2.5 border-r border-[var(--border)] px-5 whitespace-nowrap transition-all {isActive
        ? 'bg-[var(--bg-darkest)]'
        : 'bg-[var(--bg-dark)] hover:bg-[var(--bg-medium)] hover:text-[var(--text-secondary)]'}"
      style={isActive ? "border-top: 2px solid var(--accent); margin-top: -1px;" : ""}
      role="tab"
      aria-selected={isActive}
      aria-label="Вкладка {file.name}{isPreviewTab(file.id) ? ' (предпросмотр)' : ''}"
      tabindex="0"
      onclick={() => handleSelectFile(file.id)}
      onkeydown={(event) => handleTabKeydown(event, file.id)}
    >
      <FileText
        size={15}
        class="shrink-0 {isActive ? 'text-[var(--accent)]' : 'text-[var(--text-tertiary)]'}"
      />
      <span
        class="text-[13px] {isActive
          ? 'font-medium text-[var(--text-primary)]'
          : 'text-[var(--text-tertiary)]'} {isPreviewTab(file.id) ? 'italic' : ''}"
      >
        {file.name}
      </span>
      <button
        type="button"
        onclick={(event) => handleCloseFile(event, file.id)}
        class="ml-1 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[3px] opacity-0 transition-all group-hover:opacity-100 hover:bg-[var(--bg-lighter)]"
        aria-label="Закрыть вкладку {file.name}"
        title="Закрыть"
      >
        <X size={14} />
      </button>
    </div>
  {/each}

  {#if isCreatingFile}
    <div
      class="flex h-[39px] items-center gap-2.5 border-r border-[var(--border)] bg-[var(--bg-darkest)] px-5 whitespace-nowrap"
      style="border-top: 2px solid var(--accent); margin-top: -1px;"
    >
      <FileText size={15} class="shrink-0 text-[var(--accent)]" />
      <input
        use:autofocus
        bind:value={newFileName}
        onblur={saveNewFile}
        onkeydown={(event) => {
          event.stopPropagation();
          if (event.key === "Enter") {
            void saveNewFile();
          }
          if (event.key === "Escape") {
            cancelNewFile();
          }
        }}
        class="w-28 rounded border border-[var(--accent)] bg-[var(--bg-darkest)] px-1.5 py-0.5 text-[13px] font-medium text-[var(--text-primary)] focus:outline-none"
        placeholder="Имя файла..."
        maxlength="50"
      />
    </div>
  {/if}

  <button
    type="button"
    onclick={handleCreateNewFile}
    disabled={actionInProgress}
    class="flex h-[39px] w-[39px] shrink-0 items-center justify-center text-[var(--text-tertiary)] transition-colors hover:bg-[var(--bg-light)] hover:text-[var(--text-primary)] disabled:pointer-events-none disabled:opacity-40"
    aria-label="Создать новый файл промпта"
    title="Новый файл"
  >
    <Plus size={16} />
  </button>
</div>

<style>
  /* Скрываем нативный скроллбар, но оставляем возможность прокрутки */
  .tabsbar-scroll {
    scrollbar-width: none; /* Firefox */
  }
  .tabsbar-scroll::-webkit-scrollbar {
    display: none; /* Chrome, Edge, Safari */
  }
</style>