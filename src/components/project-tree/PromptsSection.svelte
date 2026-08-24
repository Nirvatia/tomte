<script lang="ts">
  import {
    ChevronDown,
    ChevronRight,
    FileText,
    Pencil,
    Plus,
    Trash2,
  } from "@lucide/svelte";

  import { requestConfirm } from "../../stores/confirm";
  import {
    activeFileId,
    openFileIds,
    previewFileId,
    promptFiles,
  } from "../../stores";

  import {
    createPromptFile,
    deletePromptFile,
    pinPromptFile,
    previewPromptFile,
    renamePromptFile,
  } from "../../utils/projectActions";

  let isPromptsSectionOpen = $state(true);
  let editingFileId = $state<string | null>(null);
  let editingFileName = $state("");
  let newFileName = $state("");
  let isCreatingFile = $state(false);
  let actionInProgress = $state(false);
  let newFileInput = $state<HTMLInputElement | null>(null);

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
      const newFileId = await createPromptFile(newFileName.trim());
      if (newFileId) {
        cancelNewFile();
      } else {
        cancelNewFile();
      }
    } finally {
      actionInProgress = false;
    }
  }

  function cancelNewFile() {
    isCreatingFile = false;
    newFileName = "";
  }

  function handleSelectFile(fileId: string) {
    void previewPromptFile(fileId);
  }

  function handlePinFile(fileId: string) {
    void pinPromptFile(fileId);
  }

  function isFileInPreview(fileId: string): boolean {
    return fileId === $previewFileId && !$openFileIds.includes(fileId);
  }

  function handleStartRename(fileId: string, currentName: string) {
    if (actionInProgress) return;
    editingFileId = fileId;
    editingFileName = currentName;
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
      const success = await renamePromptFile(fileId, name);
      if (success) {
        cancelRename();
      } else {
        cancelRename();
      }
    } finally {
      actionInProgress = false;
    }
  }

  function cancelRename() {
    editingFileId = null;
    editingFileName = "";
  }

  async function handleDeleteFile(fileId: string, fileName: string) {
    if (actionInProgress) return;
    const isLastFile = $promptFiles.length <= 1;
    const message = isLastFile
      ? `Удалить файл «${fileName}»?\n\nПроект не может остаться без файлов, поэтому будет создан новый пустой файл.`
      : `Удалить файл «${fileName}»?\nЭто действие нельзя отменить.`;

    const confirmed = await requestConfirm({
      title: isLastFile ? "Удалить последний файл?" : "Удалить файл промпта?",
      message,
      confirmText: "Удалить",
      cancelText: "Отмена",
      danger: true,
    });

    if (!confirmed) return;

    actionInProgress = true;
    try {
      await deletePromptFile(fileId);
    } finally {
      actionInProgress = false;
    }
  }
</script>

<div class="tree-section mb-1">
  <button
    type="button"
    onclick={() => (isPromptsSectionOpen = !isPromptsSectionOpen)}
    class="tree-section-header flex w-full items-center gap-1.5 px-4 py-1.5 text-[12px] font-semibold text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-light)]"
  >
    {#if isPromptsSectionOpen}
      <ChevronDown size={12} />
    {:else}
      <ChevronRight size={12} />
    {/if}
    <span>Prompts</span>
    <span class="ml-auto font-mono text-[10px] text-[var(--text-tertiary)]">
      {$promptFiles.length}
    </span>
  </button>

  {#if isPromptsSectionOpen}
    <div class="py-1">
      {#each $promptFiles as file (file.id)}
        <div
          class="group flex items-center gap-2 border-l-2 border-transparent py-[5px] pr-4 pl-[28px] text-[13px] transition-all hover:bg-[var(--bg-light)] {$activeFileId ===
          file.id
            ? 'border-l-[var(--accent)] bg-[var(--accent-dim)] font-medium text-[var(--accent)]'
            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}"
        >
          {#if editingFileId === file.id}
            <input
              type="text"
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
              class="flex-1 rounded border border-[var(--accent)] bg-[var(--bg-darkest)] px-2 py-0.5 text-[13px] text-[var(--text-primary)] focus:outline-none"
              autofocus
            />
          {:else}
            <button
              type="button"
              onclick={() => handleSelectFile(file.id)}
              ondblclick={() => handlePinFile(file.id)}
              class="flex flex-1 items-center gap-2 truncate text-left"
              title="{file.name} (клик — предпросмотр, двойной клик — закрепить)"
            >
              <FileText size={14} class="shrink-0" />
              <span class="truncate {isFileInPreview(file.id) ? 'italic' : ''}">
                {file.name}
              </span>
            </button>

            <div
              class="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100"
            >
              <button
                type="button"
                onclick={() => handleStartRename(file.id, file.name)}
                disabled={actionInProgress}
                class="rounded p-1 text-[var(--text-tertiary)] transition-colors hover:bg-[var(--bg-lighter)] hover:text-[var(--text-primary)] disabled:pointer-events-none disabled:opacity-40"
                title="Переименовать"
                aria-label="Переименовать файл {file.name}"
              >
                <Pencil size={12} />
              </button>
              <button
                type="button"
                onclick={() => handleDeleteFile(file.id, file.name)}
                disabled={actionInProgress}
                class="rounded p-1 text-[var(--text-tertiary)] transition-colors hover:bg-[var(--error)]/10 hover:text-[var(--error)] disabled:pointer-events-none disabled:opacity-40"
                title="Удалить"
                aria-label="Удалить файл {file.name}"
              >
                <Trash2 size={12} />
              </button>
            </div>
          {/if}
        </div>
      {/each}

      {#if isCreatingFile}
        <div
          class="flex items-center gap-2 border-l-2 border-[var(--accent)] bg-[var(--accent-dim)] py-[5px] pr-4 pl-[28px]"
        >
          <FileText size={14} class="shrink-0 text-[var(--accent)]" />
          <input
            bind:this={newFileInput}
            type="text"
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
            placeholder="Имя файла..."
            class="flex-1 rounded border border-[var(--accent)] bg-[var(--bg-darkest)] px-2 py-0.5 text-[13px] text-[var(--text-primary)] focus:outline-none"
          />
        </div>
      {/if}

      {#if $promptFiles.length === 0 && !isCreatingFile}
        <div class="px-4 py-3 text-center">
          <p class="text-[11px] text-[var(--text-tertiary)]">
            Нет файлов промптов
          </p>
          <button
            type="button"
            onclick={handleCreateNewFile}
            disabled={actionInProgress}
            class="mt-2 inline-flex items-center gap-1 rounded border border-[var(--border)] bg-[var(--bg-light)] px-2.5 py-1 text-[11px] text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-lighter)] hover:text-[var(--text-primary)] disabled:pointer-events-none disabled:opacity-40"
          >
            <Plus size={11} />
            Создать файл
          </button>
        </div>
      {/if}
    </div>
  {/if}
</div>
