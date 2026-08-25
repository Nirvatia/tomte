<script lang="ts">
  import {
    CircleAlert,
    Copy,
    FileText,
    FolderKanban,
    FolderTree,
    LoaderCircle,
    Paperclip,
    Pencil,
    Plus,
    Search,
    Trash2,
    X,
  } from "@lucide/svelte";

  import type { Project } from "../../types";

  import { activeProject, isProjectManagerOpen } from "../../stores";
  import { requestAlert, requestConfirm } from "../../stores/confirm";

  import { formatFileSize, getErrorMessage, pluralize } from "../../utils";
  import { calculateProjectSize, loadAllProjects } from "../../utils/projectDb";
  import {
    createNewProject,
    deleteProjectById,
    duplicateProjectById,
    renameProjectById,
    switchProject,
  } from "../../utils/projectActions";

  let projects = $state<Project[]>([]);
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
      const all = await loadAllProjects();
      projects = [...all]
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .map((p) => ({ ...p, totalSize: calculateProjectSize(p) }));
    } catch (error) {
      console.error("Failed to load projects:", error);
      projects = [];
      errorMessage = "Не удалось загрузить список проектов.";
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

  const suggestedName = $derived(`Проект ${projects.length + 1}`);

  function close() {
    if (actionInProgress) return;
    isProjectManagerOpen.set(false);
  }

  function handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      close();
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Escape" && isCreating) {
      cancelCreate();
      return;
    }
    if (event.key === "Escape" && !actionInProgress && !renamingProjectId) {
      close();
    }
  }

  function handleBackdropKeydown(event: KeyboardEvent) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
    }
    if (event.key === "Escape") {
      if (isCreating) {
        cancelCreate();
        return;
      }
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
      errorMessage = getErrorMessage(error, "Не удалось создать новый проект.");
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
      errorMessage = getErrorMessage(error, "Не удалось переключить проект.");
    } finally {
      actionInProgress = false;
    }
  }

  function startRename(project: Project, event: MouseEvent) {
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
      errorMessage = getErrorMessage(error, "Не удалось переименовать проект.");
    } finally {
      actionInProgress = false;
    }
  }

  function cancelRename() {
    renamingProjectId = null;
    renameValue = "";
  }

  async function handleDelete(project: Project, event: MouseEvent) {
    event.stopPropagation();
    if (actionInProgress) return;
    if (projects.length <= 1) return;
    const confirmed = await requestConfirm({
      title: "Удалить проект?",
      message: `Проект «${project.name}» будет удалён.\nЭто действие нельзя отменить.`,
      confirmText: "Удалить",
      cancelText: "Отмена",
      danger: true,
    });
    if (!confirmed) return;
    actionInProgress = true;
    errorMessage = null;
    try {
      const success = await deleteProjectById(project.id);
      if (!success) {
        await requestAlert({
          title: "Нельзя удалить",
          message:
            "Это последний проект. Создайте новый проект перед удалением текущего.",
          confirmText: "Понятно",
        });
      }
      await loadProjects();
    } catch (error) {
      console.error("Failed to delete project:", error);
      errorMessage = getErrorMessage(error, "Не удалось удалить проект.");
    } finally {
      actionInProgress = false;
    }
  }

  async function handleDuplicate(project: Project, event: MouseEvent) {
    event.stopPropagation();
    if (actionInProgress) return;
    actionInProgress = true;
    errorMessage = null;
    try {
      await duplicateProjectById(project.id);
      await loadProjects();
    } catch (error) {
      console.error("Failed to duplicate project:", error);
      errorMessage = getErrorMessage(error, "Не удалось дублировать проект.");
    } finally {
      actionInProgress = false;
    }
  }

  function formatRelativeTime(isoString: string): string {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 1) return "только что";
    if (diffMins < 60) return `${diffMins} мин. назад`;
    if (diffHours < 24) return `${diffHours} ч. назад`;
    if (diffDays < 7) return `${diffDays} дн. назад`;
    return date.toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if $isProjectManagerOpen}
  <div
    class="fixed inset-0 z-50 flex animate-fade-in items-center justify-center bg-black/60 p-4 backdrop-blur-[2px]"
    onclick={handleBackdropClick}
    onkeydown={handleBackdropKeydown}
    role="dialog"
    aria-modal="true"
    aria-label="Менеджер проектов"
    tabindex="-1"
  >
    <div
      class="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-xl border border-[var(--border-light)] bg-[var(--bg-dark)] shadow-[var(--shadow-lg)]"
      role="presentation"
      onclick={(event) => event.stopPropagation()}
      onkeydown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
        }
      }}
    >
      <div
        class="flex items-center justify-between border-b border-[var(--border)] p-6"
      >
        <div>
          <h2
            class="flex items-center gap-2 text-xl font-bold text-[var(--text-primary)]"
          >
            <FolderKanban size={22} class="text-[var(--accent)]" />
            Менеджер проектов
          </h2>
          <p class="mt-1 text-sm text-[var(--text-tertiary)]">
            Всего: <strong class="font-semibold text-[var(--text-primary)]"
              >{projects.length}</strong
            >
          </p>
        </div>
        <button
          type="button"
          onclick={close}
          disabled={actionInProgress}
          class="rounded-lg p-2 text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-lighter)] hover:text-[var(--text-primary)] disabled:pointer-events-none disabled:opacity-40"
          aria-label="Закрыть менеджер проектов"
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
                  cancelCreate();
                }
              }}
              type="text"
              placeholder="Имя нового проекта..."
              class="w-full rounded-md border border-[var(--accent)] bg-[var(--bg-darkest)] px-3.5 py-2 text-sm text-[var(--text-primary)] transition-all placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/15"
              maxlength="100"
              aria-label="Имя нового проекта"
            />
            <button
              type="button"
              onclick={() => void submitCreate()}
              disabled={actionInProgress || !newProjectName.trim()}
              class="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md bg-[var(--accent)] px-4 text-xs font-semibold text-[var(--bg-darkest)] transition-colors hover:bg-[var(--accent-hover)] disabled:pointer-events-none disabled:opacity-50"
            >
              {#if actionInProgress}
                <LoaderCircle size={14} class="animate-spin" />
              {:else}
                <Plus size={14} />
              {/if}
              Создать
            </button>
            <button
              type="button"
              onclick={cancelCreate}
              disabled={actionInProgress}
              class="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--bg-dark)] px-4 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-lighter)] hover:text-[var(--text-primary)] disabled:pointer-events-none disabled:opacity-40"
            >
              Отмена
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
                placeholder="Поиск по имени проекта..."
                class="w-full rounded-md border border-[var(--border)] bg-[var(--bg-darkest)] py-2 pl-9 pr-3 text-sm text-[var(--text-primary)] transition-all placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent)]/60 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/15"
                aria-label="Поиск по проектам"
              />
            </div>
            <button
              type="button"
              onclick={startCreate}
              disabled={actionInProgress}
              class="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md bg-[var(--accent)] px-4 text-xs font-semibold text-[var(--bg-darkest)] transition-colors hover:bg-[var(--accent-hover)] disabled:pointer-events-none disabled:opacity-50"
            >
              <Plus size={14} />
              Новый проект
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
              Загрузка проектов...
            </p>
          </div>
        {:else if filteredProjects.length === 0}
          <div class="py-16 text-center">
            <FolderKanban
              size={40}
              class="mx-auto mb-3 text-[var(--text-dim)]"
            />
            <p class="text-sm font-medium text-[var(--text-secondary)]">
              {searchQuery.trim() ? "Ничего не найдено" : "Нет проектов"}
            </p>
            {#if searchQuery.trim()}
              <p class="mt-1 text-xs text-[var(--text-tertiary)]">
                Попробуйте изменить запрос
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
                aria-label="{isActive
                  ? 'Активный проект'
                  : 'Переключиться на проект'} {project.name}"
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
                        class="shrink-0 rounded-full bg-[var(--accent)]/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--accent)]"
                      >
                        Активный
                      </span>
                    {/if}
                  </div>
                {/if}

                <div
                  class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[var(--text-tertiary)]"
                >
                  <span class="flex items-center gap-1">
                    <FileText size={12} />
                    {project.files.length}
                    {pluralize(
                      project.files.length,
                      "промпт",
                      "промпта",
                      "промптов",
                    )}
                  </span>
                  <span class="flex items-center gap-1">
                    <Paperclip size={12} />
                    {project.attachments.length}
                    {pluralize(
                      project.attachments.length,
                      "вложение",
                      "вложения",
                      "вложений",
                    )}
                  </span>
                  {#if project.projectTreeSource}
                    <span class="flex items-center gap-1">
                      <FolderTree size={12} />
                      дерево
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
                  class="absolute right-3 top-3 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <button
                    type="button"
                    onclick={(event) => startRename(project, event)}
                    disabled={actionInProgress}
                    class="flex h-7 w-7 items-center justify-center rounded text-[var(--text-tertiary)] transition-colors hover:bg-[var(--bg-lighter)] hover:text-[var(--text-primary)] disabled:pointer-events-none disabled:opacity-40"
                    title="Переименовать"
                    aria-label="Переименовать проект {project.name}"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    type="button"
                    onclick={(event) => handleDuplicate(project, event)}
                    disabled={actionInProgress}
                    class="flex h-7 w-7 items-center justify-center rounded text-[var(--text-tertiary)] transition-colors hover:bg-[var(--bg-lighter)] hover:text-[var(--text-primary)] disabled:pointer-events-none disabled:opacity-40"
                    title="Дублировать"
                    aria-label="Дублировать проект {project.name}"
                  >
                    <Copy size={13} />
                  </button>
                  <button
                    type="button"
                    onclick={(event) => handleDelete(project, event)}
                    disabled={projects.length <= 1 || actionInProgress}
                    class="flex h-7 w-7 items-center justify-center rounded text-[var(--text-tertiary)] transition-colors hover:bg-[var(--error)]/10 hover:text-[var(--error)] disabled:pointer-events-none disabled:opacity-30"
                    title={projects.length <= 1
                      ? "Нельзя удалить последний проект"
                      : "Удалить"}
                    aria-label="Удалить проект {project.name}"
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
    </div>
  </div>
{/if}