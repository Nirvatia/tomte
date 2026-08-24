<script lang="ts">
  import { FileText, Plus, X } from "@lucide/svelte";

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
    renamePromptFile,
  } from "../../utils/projectActions";

  let editingFileId = $state<string | null>(null);
  let editingFileName = $state("");
  let newFileName = $state("");
  let isCreatingFile = $state(false);
  let actionInProgress = $state(false);

  let editingInput = $state<HTMLInputElement | null>(null);
  let newFileInput = $state<HTMLInputElement | null>(null);

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
    let candidate = `prompt-${counter}.md`;

    while (names.has(candidate.toLowerCase())) {
      counter += 1;
      candidate = `prompt-${counter}.md`;
    }
    return candidate;
  }

  function handleSelectFile(fileId: string) {
    void activatePromptFile(fileId);
  }

  function handleStartRename(fileId: string, currentName: string) {
    if (actionInProgress) return;
    editingFileId = fileId;
    editingFileName = currentName;
    setTimeout(() => editingInput?.focus(), 50);
  }

  async function saveRename() {
    if (actionInProgress) return;
    if (!editingFileId || !editingFileName.trim()) {
      cancelRename();
      return;
    }

    const fileId = editingFileId;
    const name = editingFileName;
    actionInProgress = true;

    try {
      await renamePromptFile(fileId, name);
      cancelRename();
    } finally {
      actionInProgress = false;
    }
  }

  function cancelRename() {
    editingFileId = null;
    editingFileName = "";
  }

  function handleCloseFile(event: MouseEvent, fileId: string) {
    event.stopPropagation();
    void closePromptFileTab(fileId);
  }

  function handleCreateNewFile() {
    if (actionInProgress || isCreatingFile) return;
    isCreatingFile = true;
    newFileName = suggestNewFileName();
    setTimeout(() => newFileInput?.focus(), 50);
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

  function handleTabKeydown(event: KeyboardEvent) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
    }
  }
</script>

<div
  class="flex h-[40px] shrink-0 items-end overflow-x-auto border-b border-[var(--border)] bg-[var(--bg-dark)]"
  role="tablist"
  aria-label="Файлы промптов"
>
  {#each displayFiles as file (file.id)}
    {#if $activeFileId === file.id}
      <div
        class="group flex h-[39px] cursor-pointer items-center gap-2.5 border-r border-[var(--border)] bg-[var(--bg-darkest)] px-5 whitespace-nowrap transition-all"
        style="border-top: 2px solid var(--accent); margin-top: -1px;"
        role="tab"
        aria-selected="true"
        aria-label="Вкладка {file.name}{isPreviewTab(file.id)
          ? ' (предпросмотр)'
          : ''}"
        tabindex="0"
        onclick={() => handleSelectFile(file.id)}
        onkeydown={handleTabKeydown}
      >
        <FileText size={15} class="shrink-0 text-[var(--accent)]" />

        {#if editingFileId === file.id}
          <input
            bind:this={editingInput}
            bind:value={editingFileName}
            onblur={saveRename}
            onkeydown={(event) => {
              event.stopPropagation();
              if (event.key === "Enter") {
                void saveRename();
              }
              if (event.key === "Escape") {
                cancelRename();
              }
            }}
            onclick={(event) => event.stopPropagation()}
            class="w-28 rounded border border-[var(--accent)] bg-[var(--bg-darkest)] px-1.5 py-0.5 text-[13px] font-medium text-[var(--text-primary)] focus:outline-none"
            maxlength="50"
          />
        {:else}
          <span
            class="text-[13px] font-medium text-[var(--text-primary)] {isPreviewTab(
              file.id,
            )
              ? 'italic'
              : ''}"
          >
            {file.name}
          </span>
        {/if}

        <button
          type="button"
          onclick={(event) => handleCloseFile(event, file.id)}
          class="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[3px] transition-all opacity-0 hover:bg-[var(--bg-lighter)] group-hover:opacity-100"
          aria-label="Закрыть вкладку {file.name}"
          title="Закрыть"
        >
          <X size={14} />
        </button>
      </div>
    {:else}
      <div
        class="group flex h-[39px] cursor-pointer items-center gap-2.5 border-r border-[var(--border)] bg-[var(--bg-dark)] px-5 whitespace-nowrap transition-all hover:bg-[var(--bg-medium)] hover:text-[var(--text-secondary)]"
        onclick={() => handleSelectFile(file.id)}
        role="tab"
        aria-selected="false"
        aria-label="Вкладка {file.name}{isPreviewTab(file.id)
          ? ' (предпросмотр)'
          : ''}"
        tabindex="0"
        onkeydown={handleTabKeydown}
      >
        <FileText size={15} class="shrink-0 text-[var(--text-tertiary)]" />

        {#if editingFileId === file.id}
          <input
            bind:this={editingInput}
            bind:value={editingFileName}
            onblur={saveRename}
            onkeydown={(event) => {
              event.stopPropagation();
              if (event.key === "Enter") {
                void saveRename();
              }
              if (event.key === "Escape") {
                cancelRename();
              }
            }}
            onclick={(event) => event.stopPropagation()}
            class="w-28 rounded border border-[var(--accent)] bg-[var(--bg-darkest)] px-1.5 py-0.5 text-[13px] text-[var(--text-primary)] focus:outline-none"
            maxlength="50"
          />
        {:else}
          <span
            class="text-[13px] text-[var(--text-tertiary)] {isPreviewTab(
              file.id,
            )
              ? 'italic'
              : ''}"
          >
            {file.name}
          </span>
        {/if}

        <button
          type="button"
          onclick={(event) => handleCloseFile(event, file.id)}
          class="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[3px] transition-all opacity-0 hover:bg-[var(--bg-lighter)] group-hover:opacity-100"
          aria-label="Закрыть вкладку {file.name}"
          title="Закрыть"
        >
          <X size={14} />
        </button>
      </div>
    {/if}
  {/each}

  {#if isCreatingFile}
    <div
      class="flex h-[39px] items-center gap-2.5 border-r border-[var(--border)] bg-[var(--bg-darkest)] px-5 whitespace-nowrap"
      style="border-top: 2px solid var(--accent); margin-top: -1px;"
    >
      <FileText size={15} class="shrink-0 text-[var(--accent)]" />
      <input
        bind:this={newFileInput}
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
