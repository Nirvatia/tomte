<script lang="ts">
  import { formatRelativeTime, t } from "$lib/i18n";
  import {
    Copy,
    Download,
    FileText,
    FolderTree,
    Paperclip,
    Pencil,
    Trash2,
  } from "@lucide/svelte";

  import { autofocus } from "$lib/actions/autofocus";
  import { formatFileSize } from "../../utils";
  import type { ProjectSummary } from "../../utils/projectDb";

  /**
   * Строка проекта в менеджере (этап 15.2): переключение по клику,
   * переименование на месте, копия, бэкап, удаление.
   */
  interface Props {
    project: ProjectSummary;
    isActive: boolean;
    isRenaming: boolean;
    busy: boolean;
    /** Последний проект удалить нельзя. */
    canDelete: boolean;
    onSwitch: () => void;
    onStartRename: () => void;
    onSaveRename: (name: string) => void;
    onCancelRename: () => void;
    onDuplicate: () => void;
    onExport: () => void;
    onDelete: () => void;
  }

  let {
    project,
    isActive,
    isRenaming,
    busy,
    canDelete,
    onSwitch,
    onStartRename,
    onSaveRename,
    onCancelRename,
    onDuplicate,
    onExport,
    onDelete,
  }: Props = $props();

  let renameValue = $state("");

  // Начало переименования: поле получает текущее имя.
  $effect(() => {
    if (isRenaming) renameValue = project.name;
  });

  /** Кнопки строки не должны переключать проект кликом по самой строке. */
  function action(handler: () => void) {
    return (event: MouseEvent) => {
      event.stopPropagation();
      handler();
    };
  }

  const ACTION_BASE =
    "flex h-7 w-7 items-center justify-center rounded text-[var(--text-tertiary)] transition-colors disabled:pointer-events-none";
  const ACTION_BTN = `${ACTION_BASE} hover:bg-[var(--bg-lighter)] hover:text-[var(--text-primary)] disabled:opacity-40`;
  const DELETE_BTN = `${ACTION_BASE} hover:bg-[var(--error)]/10 hover:text-[var(--error)] disabled:opacity-30`;
</script>

<div
  class="group relative cursor-pointer rounded-lg border p-4 transition-all {isActive
    ? 'border-[var(--accent)]/50 bg-[var(--accent-dim)]'
    : 'border-[var(--border)] bg-[var(--bg-medium)] hover:border-[var(--border-light)] hover:bg-[var(--bg-light)]'}"
  onclick={onSwitch}
  onkeydown={(event) => {
    // Только когда фокус на самой строке: Enter и пробел на её кнопках
    // раньше гасились здесь и переключали проект вместо действия.
    if (event.target !== event.currentTarget) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSwitch();
    }
  }}
  role="button"
  tabindex="0"
  aria-label={$t(isActive ? "projects.activeProject" : "projects.switchTo", {
    name: project.name,
  })}
>
  {#if isRenaming}
    <input
      use:autofocus
      bind:value={renameValue}
      onblur={() => onSaveRename(renameValue)}
      onkeydown={(event) => {
        // Escape и Enter — для поля: менеджер и строка их не получают.
        event.stopPropagation();
        if (event.key === "Enter") onSaveRename(renameValue);
        if (event.key === "Escape") onCancelRename();
      }}
      onclick={(event) => event.stopPropagation()}
      class="w-full rounded border border-[var(--accent)] bg-[var(--bg-darkest)] px-2 py-1 text-sm font-medium text-[var(--text-primary)] focus:outline-none"
      maxlength="100"
    />
  {:else}
    <div class="flex items-center gap-2">
      {#if isActive}
        <span
          class="h-2 w-2 shrink-0 rounded-full bg-[var(--success)]"
          aria-hidden="true"
        ></span>
      {/if}
      <span class="truncate text-sm font-semibold text-[var(--text-primary)]">
        {project.name}
      </span>
      {#if isActive}
        <span
          class="shrink-0 rounded-full bg-[var(--accent)]/20 px-2 py-0.5 text-micro font-semibold uppercase tracking-wider text-[var(--accent)]"
        >
          {$t("projects.active")}
        </span>
      {/if}
    </div>
  {/if}

  <div
    class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-[var(--text-tertiary)]"
  >
    <span class="flex items-center gap-1">
      <FileText size={12} />
      {$t("projects.prompts", { count: project.fileCount })}
    </span>
    <span class="flex items-center gap-1">
      <Paperclip size={12} />
      {$t("projects.attachments", { count: project.attachmentCount })}
    </span>
    {#if project.hasTree}
      <span class="flex items-center gap-1">
        <FolderTree size={12} />
        {$t("projects.hasTree")}
      </span>
    {/if}
    <span class="font-mono">{formatFileSize(project.totalSize)}</span>
    <span>·</span>
    <span>{formatRelativeTime(project.updatedAt)}</span>
  </div>

  {#if !isRenaming}
    <div
      class="absolute right-3 top-3 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
    >
      <button
        type="button"
        onclick={action(onStartRename)}
        disabled={busy}
        class={ACTION_BTN}
        title={$t("common.rename")}
        aria-label={$t("projects.renameProject", { name: project.name })}
      >
        <Pencil size={13} />
      </button>
      <button
        type="button"
        onclick={action(onDuplicate)}
        disabled={busy}
        class={ACTION_BTN}
        title={$t("common.duplicate")}
        aria-label={$t("projects.duplicateProject", { name: project.name })}
      >
        <Copy size={13} />
      </button>
      <button
        type="button"
        onclick={action(onExport)}
        disabled={busy}
        class={ACTION_BTN}
        title={$t("backup.exportOne")}
        aria-label={$t("backup.exportOne")}
      >
        <Download size={13} />
      </button>
      <button
        type="button"
        onclick={action(onDelete)}
        disabled={!canDelete || busy}
        class={DELETE_BTN}
        title={canDelete ? $t("common.delete") : $t("projects.delete.lastHint")}
        aria-label={$t("projects.deleteProject", { name: project.name })}
      >
        <Trash2 size={13} />
      </button>
    </div>
  {/if}
</div>
