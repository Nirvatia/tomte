<script lang="ts">
  import ModalShell from "../ui/ModalShell.svelte";
  import { formatRelativeTime, t } from "$lib/i18n";
  import {
    CircleAlert,
    Copy,
    Download,
    FileText,
    FolderKanban,
    FolderTree,
    LoaderCircle,
    Paperclip,
    Pencil,
    Plus,
    Search,
    Trash2,
    Upload,
    X,
  } from "@lucide/svelte";

  import { notifyError, notifyInfo } from "$lib/notify";
  import { activeProject, isProjectManagerOpen } from "../../stores";
  import { requestAlert, requestConfirm } from "../../stores/confirm";

  import { formatFileSize, getErrorMessage } from "../../utils";
  import { exportProjectBackup, importProjectBackup } from "../../utils/backup";
  import {
    loadProject,
    loadProjectSummaries,
    type ProjectSummary,
  } from "../../utils/projectDb";
  import {
    createNewProject,
    deleteProjectById,
    duplicateProjectById,
    flushPendingEditorSave,
    renameProjectById,
    switchProject,
  } from "../../utils/projectActions";

  let projects = $state<ProjectSummary[]>([]);
  let isLoading = $state(false);
  let searchQuery = $state("");
  let renamingProjectId = $state<string | null>(null);
  let renameValue = $state("");
  let renameInput = $state<HTMLInputElement | null>(null);
  let actionInProgress = $state(false);
  let errorMessage = $state<string | null>(null);

  let isCreating = $state(false);
  let newProjectName = $state("");
  let createInput = $state<HTMLInputElement | null>(null);
  let importInput = $state<HTMLInputElement | null>(null);
  let isImporting = $state(false);

  $effect(() => {
    if ($isProjectManagerOpen) {
      void loadProjects();
      searchQuery = "";
      renamingProjectId = null;
      renameValue = "";
      errorMessage = null;
      isCreating = false;
      newProjectName = "";
    }
  });

  async function loadProjects() {
    isLoading = true;
    errorMessage = null;
    try {
      projects = await loadProjectSummaries();
    } catch (error) {
      console.error("Failed to load projects:", error);
      projects = [];
      errorMessage = $t("projects.errors.load");
    } finally {
      isLoading = false;
    }
  }

  const filteredProjects = $derived(
    searchQuery.trim()
      ? projects.filter((p) =>
          p.name.toLowerCase().includes(searchQuery.trim().toLowerCase()),
        )
      : projects,
  );

  const suggestedName = $derived(
    $t("projects.defaultName", { n: projects.length + 1 }),
  );

  function close() {
    if (actionInProgress) return;
    isProjectManagerOpen.set(false);
  }

  // Этап 10.1. Бэкап: выгрузка проекта целиком и импорт из .tomte.zip.
  async function handleExportBackup(
    project: ProjectSummary,
    event: MouseEvent,
  ) {
    event.stopPropagation();
    if (actionInProgress) return;
    actionInProgress = true;
    try {
      // Бэкап читается из базы: сначала дописываем текст, набранный за
      // последние мгновения, иначе он не попадёт в архив.
      await flushPendingEditorSave();
      const full = await loadProject(project.id);
      if (full) exportProjectBackup(full);
    } catch (error) {
      console.error("Failed to export backup:", error);
      notifyError(getErrorMessage(error, $t("backup.errors.export")));
    } finally {
      actionInProgress = false;
    }
  }

  async function handleImportChange(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";
    if (!file || isImporting) return;
    isImporting = true;
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const project = await importProjectBackup(bytes);
      notifyInfo($t("backup.imported", { name: project.name }));
      await loadProjects();
    } catch (error) {
      console.error("Failed to import backup:", error);
      notifyError(getErrorMessage(error, $t("backup.errors.import")));
    } finally {
      isImporting = false;
    }
  }

  // Escape сначала отменяет создание проекта, потом закрывает менеджер.
  // Поле переименования обрабатывает Escape само и дальше его не пускает.
  function handleEscape() {
    if (isCreating) {
      cancelCreate();
    } else if (!actionInProgress && !renamingProjectId) {
      close();
    }
  }

  function startCreate() {
    if (actionInProgress || isCreating) return;
    errorMessage = null;
    renamingProjectId = null;
    newProjectName = suggestedName;
    isCreating = true;
    setTimeout(() => {
      createInput?.focus();
      createInput?.select();
    }, 50);
  }

  function cancelCreate() {
    isCreating = false;
    newProjectName = "";
  }

  async function submitCreate() {
    if (actionInProgress || !isCreating) return;
    if (!newProjectName.trim()) {
      cancelCreate();
      return;
    }
    actionInProgress = true;
    errorMessage = null;
    const name = newProjectName;
    try {
      await createNewProject(name);
      await loadProjects();
      cancelCreate();
    } catch (error) {
      console.error("Failed to create project:", error);
      errorMessage = getErrorMessage(error, $t("projects.errors.create"));
    } finally {
      actionInProgress = false;
    }
  }

  async function handleSwitch(projectId: string) {
    if (actionInProgress || renamingProjectId || isCreating) return;
    if (projectId === $activeProject?.id) {
      close();
      return;
    }
    actionInProgress = true;
    errorMessage = null;
    try {
      await switchProject(projectId);
      close();
    } catch (error) {
      console.error("Failed to switch project:", error);
      errorMessage = getErrorMessage(error, $t("projects.errors.switch"));
    } finally {
      actionInProgress = false;
    }
  }

  function startRename(project: ProjectSummary, event: MouseEvent) {
    event.stopPropagation();
    if (actionInProgress) return;
    errorMessage = null;
    isCreating = false;
    renamingProjectId = project.id;
    renameValue = project.name;
    setTimeout(() => renameInput?.focus(), 50);
  }

  async function saveRename() {
    if (!renamingProjectId || !renameValue.trim()) {
      cancelRename();
      return;
    }
    if (actionInProgress) return;
    const projectId = renamingProjectId;
    const newName = renameValue;
    actionInProgress = true;
    errorMessage = null;
    try {
      await renameProjectById(projectId, newName);
      cancelRename();
      await loadProjects();
    } catch (error) {
      console.error("Failed to rename project:", error);
      errorMessage = getErrorMessage(error, $t("projects.errors.rename"));
    } finally {
      actionInProgress = false;
    }
  }

  function cancelRename() {
    renamingProjectId = null;
    renameValue = "";
  }

  async function handleDelete(project: ProjectSummary, event: MouseEvent) {
    event.stopPropagation();
    if (actionInProgress) return;
    if (projects.length <= 1) return;
    const confirmed = await requestConfirm({
      title: $t("projects.delete.title"),
      message: $t("projects.delete.message", { name: project.name }),
      confirmText: $t("common.delete"),
      cancelText: $t("common.cancel"),
      danger: true,
    });
    if (!confirmed) return;
    actionInProgress = true;
    errorMessage = null;
    try {
      const success = await deleteProjectById(project.id);
      if (!success) {
        await requestAlert({
          title: $t("projects.delete.blockedTitle"),
          message: $t("projects.delete.blockedMessage"),
          confirmText: $t("common.ok"),
        });
      }
      await loadProjects();
    } catch (error) {
      console.error("Failed to delete project:", error);
      errorMessage = getErrorMessage(error, $t("projects.errors.delete"));
    } finally {
      actionInProgress = false;
    }
  }

  async function handleDuplicate(project: ProjectSummary, event: MouseEvent) {
    event.stopPropagation();
    if (actionInProgress) return;
    actionInProgress = true;
    errorMessage = null;
    try {
      await duplicateProjectById(project.id);
      await loadProjects();
    } catch (error) {
      console.error("Failed to duplicate project:", error);
      errorMessage = getErrorMessage(error, $t("projects.errors.duplicate"));
    } finally {
      actionInProgress = false;
    }
  }
</script>

{#if $isProjectManagerOpen}
  <ModalShell
    label={$t("projects.manager")}
    onClose={close}
    onEscape={handleEscape}
    width="max-w-2xl"
    panelClass="flex max-h-[85vh] flex-col"
  >
    <div
      class="flex items-center justify-between border-b border-[var(--border)] p-6"
    >
      <div>
        <h2
          class="flex items-center gap-2 text-xl font-bold text-[var(--text-primary)]"
        >
          <FolderKanban size={22} class="text-[var(--accent)]" />
          {$t("projects.manager")}
        </h2>
        <p class="mt-1 text-sm text-[var(--text-tertiary)]">
          {$t("common.total")}
          <strong class="font-semibold text-[var(--text-primary)]"
            >{projects.length}</strong
          >
        </p>
      </div>
      <button
        type="button"
        onclick={close}
        disabled={actionInProgress}
        class="icon-btn disabled:opacity-40"
        aria-label={$t("projects.closeManager")}
      >
        <X size={20} />
      </button>
    </div>

    <div
      class="border-b border-[var(--border)] bg-[var(--bg-medium)] px-6 py-4"
    >
      {#if isCreating}
        <div class="flex items-center gap-2">
          <input
            bind:this={createInput}
            bind:value={newProjectName}
            onkeydown={(event) => {
              event.stopPropagation();
              if (event.key === "Enter") {
                void submitCreate();
              }
              if (event.key === "Escape") {
                // Обработано здесь: каркас модалки не закроет менеджер.
                event.preventDefault();
                cancelCreate();
              }
            }}
            type="text"
            placeholder={$t("projects.newNamePlaceholder")}
            class="input w-full px-3.5"
            maxlength="100"
            aria-label={$t("projects.newName")}
          />
          <button
            type="button"
            onclick={() => void submitCreate()}
            disabled={actionInProgress || !newProjectName.trim()}
            class="btn btn-primary btn-md shrink-0"
          >
            {#if actionInProgress}
              <LoaderCircle size={14} class="animate-spin" />
            {:else}
              <Plus size={14} />
            {/if}
            {$t("common.create")}
          </button>
          <button
            type="button"
            onclick={cancelCreate}
            disabled={actionInProgress}
            class="btn btn-outline btn-md shrink-0"
          >
            {$t("common.cancel")}
          </button>
        </div>
      {:else}
        <div class="flex items-center gap-2">
          <div class="relative flex-1">
            <Search
              size={15}
              class="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]"
            />
            <input
              type="text"
              bind:value={searchQuery}
              placeholder={$t("projects.searchPlaceholder")}
              class="input w-full py-2 pl-9 pr-3"
              aria-label={$t("projects.search")}
            />
          </div>
          <button
            type="button"
            onclick={() => importInput?.click()}
            disabled={actionInProgress || isImporting}
            class="btn btn-outline btn-md shrink-0"
            title={$t("backup.import")}
            aria-label={$t("backup.import")}
          >
            {#if isImporting}
              <LoaderCircle size={14} class="animate-spin" />
            {:else}
              <Upload size={14} />
            {/if}
          </button>
          <input
            bind:this={importInput}
            type="file"
            accept=".zip,application/zip"
            class="hidden"
            onchange={(event) => void handleImportChange(event)}
            aria-label={$t("backup.import")}
          />
          <button
            type="button"
            onclick={startCreate}
            disabled={actionInProgress}
            class="btn btn-primary btn-md shrink-0"
          >
            <Plus size={14} />
            {$t("projects.new")}
          </button>
        </div>
      {/if}
    </div>

    {#if errorMessage}
      <div
        class="flex items-start gap-2 border-b border-[var(--error)]/30 bg-[var(--error)]/10 px-6 py-3 text-xs text-[var(--error)]"
      >
        <CircleAlert size={14} class="mt-0.5 shrink-0" />
        <span>{errorMessage}</span>
      </div>
    {/if}

    <div class="min-h-0 flex-1 overflow-y-auto p-6">
      {#if isLoading}
        <div class="flex flex-col items-center justify-center py-16">
          <LoaderCircle size={32} class="animate-spin text-[var(--accent)]" />
          <p class="mt-3 text-sm text-[var(--text-tertiary)]">
            {$t("projects.loading")}
          </p>
        </div>
      {:else if filteredProjects.length === 0}
        <div class="py-16 text-center">
          <FolderKanban size={40} class="mx-auto mb-3 text-[var(--text-dim)]" />
          <p class="text-sm font-medium text-[var(--text-secondary)]">
            {searchQuery.trim()
              ? $t("common.nothingFound")
              : $t("projects.empty")}
          </p>
          {#if searchQuery.trim()}
            <p class="mt-1 text-xs text-[var(--text-tertiary)]">
              {$t("projects.tryQuery")}
            </p>
          {/if}
        </div>
      {:else}
        <div class="space-y-2">
          {#each filteredProjects as project (project.id)}
            {@const isActive = $activeProject?.id === project.id}
            <div
              class="group relative cursor-pointer rounded-lg border p-4 transition-all {isActive
                ? 'border-[var(--accent)]/50 bg-[var(--accent-dim)]'
                : 'border-[var(--border)] bg-[var(--bg-medium)] hover:border-[var(--border-light)] hover:bg-[var(--bg-light)]'}"
              onclick={() => handleSwitch(project.id)}
              onkeydown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  handleSwitch(project.id);
                }
              }}
              role="button"
              tabindex="0"
              aria-label={$t(
                isActive ? "projects.activeProject" : "projects.switchTo",
                {
                  name: project.name,
                },
              )}
            >
              {#if renamingProjectId === project.id}
                <input
                  bind:this={renameInput}
                  bind:value={renameValue}
                  onblur={saveRename}
                  onkeydown={(event) => {
                    event.stopPropagation();
                    if (event.key === "Enter") saveRename();
                    if (event.key === "Escape") cancelRename();
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
                  <span
                    class="truncate text-sm font-semibold text-[var(--text-primary)]"
                  >
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
                  {$t("projects.attachments", {
                    count: project.attachmentCount,
                  })}
                </span>
                {#if project.hasTree}
                  <span class="flex items-center gap-1">
                    <FolderTree size={12} />
                    {$t("projects.hasTree")}
                  </span>
                {/if}
                <span class="font-mono"
                  >{formatFileSize(project.totalSize)}</span
                >
                <span>·</span>
                <span>{formatRelativeTime(project.updatedAt)}</span>
              </div>

              {#if renamingProjectId !== project.id}
                <div
                  class="absolute right-3 top-3 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
                >
                  <button
                    type="button"
                    onclick={(event) => startRename(project, event)}
                    disabled={actionInProgress}
                    class="flex h-7 w-7 items-center justify-center rounded text-[var(--text-tertiary)] transition-colors hover:bg-[var(--bg-lighter)] hover:text-[var(--text-primary)] disabled:pointer-events-none disabled:opacity-40"
                    title={$t("common.rename")}
                    aria-label={$t("projects.renameProject", {
                      name: project.name,
                    })}
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    type="button"
                    onclick={(event) => handleDuplicate(project, event)}
                    disabled={actionInProgress}
                    class="flex h-7 w-7 items-center justify-center rounded text-[var(--text-tertiary)] transition-colors hover:bg-[var(--bg-lighter)] hover:text-[var(--text-primary)] disabled:pointer-events-none disabled:opacity-40"
                    title={$t("common.duplicate")}
                    aria-label={$t("projects.duplicateProject", {
                      name: project.name,
                    })}
                  >
                    <Copy size={13} />
                  </button>
                  <button
                    type="button"
                    onclick={(event) => handleExportBackup(project, event)}
                    disabled={actionInProgress}
                    class="flex h-7 w-7 items-center justify-center rounded text-[var(--text-tertiary)] transition-colors hover:bg-[var(--bg-lighter)] hover:text-[var(--text-primary)] disabled:pointer-events-none disabled:opacity-40"
                    title={$t("backup.exportOne")}
                    aria-label={$t("backup.exportOne")}
                  >
                    <Download size={13} />
                  </button>
                  <button
                    type="button"
                    onclick={(event) => handleDelete(project, event)}
                    disabled={projects.length <= 1 || actionInProgress}
                    class="flex h-7 w-7 items-center justify-center rounded text-[var(--text-tertiary)] transition-colors hover:bg-[var(--error)]/10 hover:text-[var(--error)] disabled:pointer-events-none disabled:opacity-30"
                    title={projects.length <= 1
                      ? $t("projects.delete.lastHint")
                      : $t("common.delete")}
                    aria-label={$t("projects.deleteProject", {
                      name: project.name,
                    })}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              {/if}
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </ModalShell>
{/if}
