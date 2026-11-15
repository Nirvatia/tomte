<script lang="ts">
  import { t } from "$lib/i18n";
  import {
    Check,
    ChevronDown,
    ChevronRight,
    Download,
    FileText,
    ListChecks,
    Pencil,
    Plus,
    Trash2,
  } from "@lucide/svelte";

  import Checkbox from "../ui/Checkbox.svelte";

  import { autofocus } from "$lib/actions/autofocus";
  import { notifyError, notifyUndo } from "$lib/notify";
  import { promptFileMenu } from "$lib/promptFileMenu";
  import { openContextMenu } from "../../stores/contextMenu";
  import { reorderable } from "$lib/actions/reorder";
  import { requestConfirm } from "../../stores/confirm";
  import {
    activeFileId,
    activeProject,
    openFileIds,
    previewFileId,
    promptFiles,
  } from "../../stores";

  import {
    createPromptFile,
    deletePromptFileWithUndo,
    deletePromptFiles,
    flushPendingEditorSave,
    movePromptFile,
    movePromptFileBy,
    pinPromptFile,
    previewPromptFile,
    renamePromptFile,
  } from "../../utils/projectActions";
  import { exportPromptsToZip } from "../../utils/export/prompts";
  import { getErrorMessage } from "../../utils";

  let isPromptsSectionOpen = $state(true);
  let editingFileId = $state<string | null>(null);
  let editingFileName = $state("");
  let newFileName = $state("");
  let isCreatingFile = $state(false);
  let actionInProgress = $state(false);
  let isManaging = $state(false);
  let selectedIds = $state<string[]>([]);
  let bulkError = $state<string | null>(null);

  interface Props {
    /** Этап 9: оверлей-сайдбар закрывается после выбора файла. */
    onFileOpen?: () => void;
  }

  let { onFileOpen = () => {} }: Props = $props();

  // Выбор живёт, пока файлы существуют: удалённые и чужие (после смены проекта) отбрасываем.
  const selectedFiles = $derived(
    $promptFiles.filter((f) => selectedIds.includes(f.id)),
  );
  const allSelected = $derived(
    $promptFiles.length > 0 && selectedFiles.length === $promptFiles.length,
  );

  function toggleManaging() {
    isManaging = !isManaging;
    if (!isManaging) clearSelection();
  }

  function toggleSelected(fileId: string) {
    bulkError = null;
    selectedIds = selectedIds.includes(fileId)
      ? selectedIds.filter((id) => id !== fileId)
      : [...selectedIds, fileId];
  }

  function toggleSelectAll() {
    bulkError = null;
    selectedIds = allSelected ? [] : $promptFiles.map((f) => f.id);
  }

  function clearSelection() {
    selectedIds = [];
    bulkError = null;
  }

  async function handleExportSelected() {
    if (actionInProgress || selectedFiles.length === 0) return;
    actionInProgress = true;
    bulkError = null;
    try {
      // В ZIP должен попасть и текст, который ещё не успел сохраниться.
      await flushPendingEditorSave();
      const ids = new Set(selectedFiles.map((f) => f.id));
      const files = ($activeProject?.files ?? []).filter((f) => ids.has(f.id));
      exportPromptsToZip(files, $activeProject?.name || "prompts");
    } catch (error) {
      bulkError = getErrorMessage(error, $t("prompts.errors.export"));
    } finally {
      actionInProgress = false;
    }
  }

  async function handleDeleteSelected() {
    if (actionInProgress || selectedFiles.length === 0) return;
    const count = selectedFiles.length;
    const deletingAll = count === $promptFiles.length;

    const confirmed = await requestConfirm({
      title: $t("prompts.deleteMany.title", { count }),
      message:
        selectedFiles.map((f) => `• ${f.name}`).join("\n") +
        (deletingAll
          ? "\n\n" + $t("prompts.deleteMany.lastNote")
          : "\n\n" + $t("common.irreversible")),
      confirmText: $t("common.delete"),
      cancelText: $t("common.cancel"),
      danger: true,
    });
    if (!confirmed) return;

    actionInProgress = true;
    try {
      await deletePromptFiles(selectedFiles.map((f) => f.id));
      clearSelection();
    } catch (error) {
      bulkError = getErrorMessage(error, $t("prompts.errors.deleteMany"));
    } finally {
      actionInProgress = false;
    }
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

  function handleSelectFile(fileId: string) {
    onFileOpen();
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

  // Один файл удаляется сразу, с отменой в уведомлении (решение этапа 5).
  async function handleDeleteFile(fileId: string, fileName: string) {
    if (actionInProgress) return;
    actionInProgress = true;
    try {
      const undo = await deletePromptFileWithUndo(fileId);
      if (undo) notifyUndo($t("prompts.deleted", { name: fileName }), undo);
    } catch (error) {
      notifyError(getErrorMessage(error, $t("prompts.errors.delete")));
    } finally {
      actionInProgress = false;
    }
  }
</script>

<div class="tree-section mb-1">
  <div class="flex items-center">
    <button
      type="button"
      onclick={() => (isPromptsSectionOpen = !isPromptsSectionOpen)}
      data-tour="prompts"
      class="tree-section-header flex flex-1 items-center gap-1.5 px-4 py-1.5 text-left text-[12px] font-semibold text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-light)]"
    >
      {#if isPromptsSectionOpen}
        <ChevronDown size={12} />
      {:else}
        <ChevronRight size={12} />
      {/if}
      <span>{$t("prompts.section")}</span>
      <span class="ml-auto font-mono text-[10px] text-[var(--text-tertiary)]">
        {$promptFiles.length}
      </span>
    </button>
    <!-- Режим выбора: чекбоксы у файлов и панель действий — только в нём,
         чтобы обычный список оставался чистым (ревизия этапа 8). -->
    <button
      type="button"
      onclick={toggleManaging}
      aria-pressed={isManaging}
      aria-label={$t("prompts.manage")}
      title={$t("prompts.manage")}
      class="mr-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-colors {isManaging
        ? 'bg-[var(--accent-dim)] text-[var(--accent)]'
        : 'text-[var(--text-tertiary)] hover:bg-[var(--bg-light)] hover:text-[var(--text-primary)]'}"
    >
      <ListChecks size={13} />
    </button>
  </div>

  {#if isPromptsSectionOpen}
    {#if isManaging}
      <div
        class="flex items-center gap-2 border-y border-[var(--border)] bg-[var(--bg-light)] py-1 pr-2 pl-[28px] text-[12px] text-[var(--text-secondary)]"
        role="toolbar"
        aria-label={$t("prompts.bulkToolbar")}
      >
        <Checkbox
          checked={allSelected}
          indeterminate={!allSelected}
          onToggle={toggleSelectAll}
          ariaLabel={allSelected
            ? $t("prompts.deselectAll")
            : $t("prompts.selectAll")}
        />
        <span class="mr-auto">
          {selectedFiles.length > 0
            ? $t("prompts.selectedCount", { count: selectedFiles.length })
            : $t("prompts.manage")}
        </span>
        <button
          type="button"
          onclick={handleExportSelected}
          disabled={actionInProgress || selectedFiles.length === 0}
          class="rounded p-1 transition-colors hover:bg-[var(--bg-lighter)] hover:text-[var(--text-primary)] disabled:pointer-events-none disabled:opacity-40"
          title={$t("prompts.downloadZipHint")}
          aria-label={$t("prompts.downloadZip")}
        >
          <Download size={14} />
        </button>
        <button
          type="button"
          onclick={handleDeleteSelected}
          disabled={actionInProgress || selectedFiles.length === 0}
          class="rounded p-1 transition-colors hover:bg-[var(--error)]/10 hover:text-[var(--error)] disabled:pointer-events-none disabled:opacity-40"
          title={$t("prompts.deleteSelectedHint")}
          aria-label={$t("prompts.deleteSelected")}
        >
          <Trash2 size={14} />
        </button>
        <button
          type="button"
          onclick={toggleManaging}
          class="rounded p-1 transition-colors hover:bg-[var(--bg-lighter)] hover:text-[var(--text-primary)]"
          title={$t("prompts.manageDone")}
          aria-label={$t("prompts.manageDone")}
        >
          <Check size={14} />
        </button>
      </div>
      {#if bulkError}
        <p class="px-4 py-1 text-[11px] text-[var(--error)]" role="alert">
          {bulkError}
        </p>
      {/if}
    {/if}
    <div class="py-1">
      {#each $promptFiles as file (file.id)}
        <div
          use:reorderable={{
            id: file.id,
            group: "prompts",
            axis: "y",
            onDrop: (dragged, target, place) =>
              void movePromptFile(dragged, target, place),
          }}
          class="group flex items-center gap-2 border-l-2 py-[5px] pr-4 text-[13px] transition-all hover:bg-[var(--bg-light)] {isManaging &&
          selectedIds.includes(file.id)
            ? 'border-l-[var(--accent)] bg-[var(--accent-dim)]'
            : 'border-l-transparent'} {$activeFileId === file.id && !isManaging
            ? 'border-l-[var(--accent)] bg-[var(--accent-dim)] font-medium text-[var(--accent)]'
            : isManaging
              ? 'text-[var(--text-secondary)]'
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
              class="input ml-[28px] h-6 flex-1 px-2 text-[13px]"
              use:autofocus
            />
          {:else if isManaging}
            <div class="flex flex-1 items-center gap-2 pl-[28px]">
              <Checkbox
                checked={selectedIds.includes(file.id)}
                onToggle={() => toggleSelected(file.id)}
                ariaLabel={$t("prompts.selectFile", { name: file.name })}
              />
              <button
                type="button"
                onclick={() => toggleSelected(file.id)}
                class="flex flex-1 items-center gap-2 truncate text-left"
                title={file.name}
              >
                <FileText size={14} class="shrink-0" />
                <span
                  class="truncate {isFileInPreview(file.id) ? 'italic' : ''}"
                >
                  {file.name}
                </span>
              </button>
            </div>
          {:else}
            <button
              type="button"
              onclick={() => handleSelectFile(file.id)}
              ondblclick={() => handlePinFile(file.id)}
              onkeydown={(event) => {
                if (event.key === "F2") {
                  event.preventDefault();
                  handleStartRename(file.id, file.name);
                } else if (
                  event.altKey &&
                  (event.key === "ArrowUp" || event.key === "ArrowDown")
                ) {
                  // Без мыши: Alt+↑/↓ двигает файл в списке.
                  event.preventDefault();
                  const button = event.currentTarget;
                  void movePromptFileBy(
                    file.id,
                    event.key === "ArrowDown" ? 1 : -1,
                  ).then(() => button.focus());
                }
              }}
              oncontextmenu={(event) =>
                openContextMenu(
                  event,
                  promptFileMenu(file, "sidebar", () =>
                    handleStartRename(file.id, file.name),
                  ),
                )}
              class="ml-[28px] flex flex-1 items-center gap-2 truncate text-left"
              title={$t("prompts.rowHint", { name: file.name })}
            >
              <FileText size={14} class="shrink-0" />
              <span class="truncate {isFileInPreview(file.id) ? 'italic' : ''}">
                {file.name}
              </span>
            </button>

            <div
              class="flex items-center gap-3 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
            >
              <button
                type="button"
                onclick={() => handleStartRename(file.id, file.name)}
                disabled={actionInProgress}
                class="rounded p-1 text-[var(--text-tertiary)] transition-colors hover:bg-[var(--bg-lighter)] hover:text-[var(--text-primary)] disabled:pointer-events-none disabled:opacity-40"
                title={$t("common.rename")}
                aria-label={$t("prompts.renameFile", { name: file.name })}
              >
                <Pencil size={14} />
              </button>
              <button
                type="button"
                onclick={() => handleDeleteFile(file.id, file.name)}
                disabled={actionInProgress}
                class="rounded p-1 text-[var(--text-tertiary)] transition-colors hover:bg-[var(--error)]/10 hover:text-[var(--error)] disabled:pointer-events-none disabled:opacity-40"
                title={$t("common.delete")}
                aria-label={$t("prompts.deleteFile", { name: file.name })}
              >
                <Trash2 size={14} />
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
            use:autofocus
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
            placeholder={$t("prompts.fileNamePlaceholder")}
            class="input h-6 flex-1 px-2 text-[13px]"
          />
        </div>
      {/if}

      {#if $promptFiles.length === 0 && !isCreatingFile}
        <div class="px-4 py-3 text-center">
          <p class="text-[11px] text-[var(--text-tertiary)]">
            {$t("prompts.empty")}
          </p>
          <button
            type="button"
            onclick={handleCreateNewFile}
            disabled={actionInProgress}
            class="btn btn-ghost btn-sm mt-2"
          >
            <Plus size={14} />
            {$t("prompts.createFile")}
          </button>
        </div>
      {/if}
    </div>
  {/if}
</div>
