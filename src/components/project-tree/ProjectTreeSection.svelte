<script lang="ts">
  import { logError } from "$lib/log";
  import TreeFilterPopover from "./TreeFilterPopover.svelte";
  import { t } from "$lib/i18n";
  import { browser } from "$app/environment";
  import { directoryPicker } from "$lib/actions/directoryPicker";

  import {
    ChevronDown,
    ChevronRight,
    CircleAlert,
    Copy,
    FileInput,
    FolderGit,
    FolderOpen,
    FolderTree,
    LoaderCircle,
    RefreshCw,
    Trash2,
  } from "@lucide/svelte";

  import type { Editor } from "@tiptap/core";

  import Checkbox from "../ui/Checkbox.svelte";
  import TreeNodeItem from "./TreeNodeItem.svelte";

  import {
    activeProject,
    filteredTreePathSet,
    gitignoreFilterPatterns,
    projectTreeNodes,
    projectTreeRootName,
    projectTreeString,
    selectedProjectFiles,
  } from "../../stores";

  import {
    clearGithubConfig,
    clearProjectTreeSource,
    restoreGithubTree,
    setProjectTreeSource,
  } from "../../utils/projectActions";
  import {
    calculateStats,
    filterTree,
    hasFileSystemAccess,
    readDirectoryRecursive,
    readDirectoryViaInput,
    readTreeFileContent,
  } from "../../utils/projectTree";
  import { excludeFilteredPaths, parseGitignore } from "../../utils/treeFilter";

  import { requestConfirm } from "../../stores/confirm";
  import { SECTION_TOOL_BTN } from "./constants";
  import { getErrorMessage } from "../../utils";

  interface Props {
    editor?: Editor | null;
    onOpenGithubModal?: () => void;
  }

  let { editor = null, onOpenGithubModal = () => {} }: Props = $props();

  let isTreeSectionOpen = $state(true);
  let isLoading = $state(false);
  let error = $state<string | null>(null);
  let copied = $state(false);
  let fileInput = $state<HTMLInputElement | null>(null);
  let supportsFileSystem = $state(false);

  const hasSavedGithub = $derived(!!$activeProject?.githubConfig);

  $effect(() => {
    if (browser) {
      supportsFileSystem = hasFileSystemAccess();
    }
  });

  const stats = $derived(
    $projectTreeNodes.length === 0 ? null : calculateStats($projectTreeNodes),
  );

  // Поиск по дереву (5.6). Пока он активен, «выбрать все» действует на найденное.
  let treeQuery = $state("");
  const filtered = $derived(
    treeQuery.trim() ? filterTree($projectTreeNodes, treeQuery) : null,
  );
  const visibleNodes = $derived(filtered?.nodes ?? $projectTreeNodes);
  const visiblePaths = $derived(getAllFilePaths(visibleNodes));

  // Фильтр выбора (10.6): отсеянные не участвуют в выборе.
  const selectablePaths = $derived(
    excludeFilteredPaths(visiblePaths, $filteredTreePathSet),
  );

  const totalFiles = $derived(stats?.totalFiles ?? 0);
  const selectedCount = $derived($selectedProjectFiles.length);
  const selectedVisible = $derived(
    selectablePaths.filter((p) => $selectedProjectFiles.includes(p)).length,
  );
  const isAllSelected = $derived(
    selectablePaths.length > 0 && selectedVisible === selectablePaths.length,
  );
  const isPartialSelected = $derived(
    selectedVisible > 0 && selectedVisible < selectablePaths.length,
  );

  function toggleSelectAll() {
    if (selectedVisible > 0) {
      deselectAll();
    } else {
      selectAll();
    }
  }

  function getAllFilePaths(nodes: typeof $projectTreeNodes): string[] {
    const paths: string[] = [];
    function traverse(items: typeof $projectTreeNodes) {
      for (const item of items) {
        if (item.type === "file") {
          paths.push(item.path);
        } else {
          traverse(item.children);
        }
      }
    }
    traverse(nodes);
    return paths;
  }

  function selectAll() {
    selectedProjectFiles.update((current) => [
      ...new Set([...current, ...selectablePaths]),
    ]);
  }

  function deselectAll() {
    const visible = new Set(visiblePaths);
    selectedProjectFiles.update((current) =>
      current.filter((path) => !visible.has(path)),
    );
  }

  // Правила .gitignore корня дерева: перечитываем при смене дерева.
  $effect(() => {
    const nodes = $projectTreeNodes;
    const gitignoreNode = nodes.find(
      (node) => node.type === "file" && node.path === ".gitignore",
    );
    let cancelled = false;
    if (!gitignoreNode) {
      gitignoreFilterPatterns.set([]);
      return;
    }
    void readTreeFileContent(gitignoreNode).then((content) => {
      if (cancelled) return;
      gitignoreFilterPatterns.set(content ? parseGitignore(content) : []);
    });
    return () => {
      cancelled = true;
    };
  });

  async function handlePickDirectory() {
    error = null;
    isLoading = true;

    try {
      if (supportsFileSystem) {
        const dirHandle = await window.showDirectoryPicker!({ mode: "read" });
        const nodes = await readDirectoryRecursive(dirHandle);
        const fileCount = calculateStats(nodes).totalFiles;
        const saved = await setProjectTreeSource({
          rootName: dirHandle.name,
          nodes,
          fileCount,
        });

        if (saved) {
          await clearGithubConfig();
        }
      } else {
        fileInput?.click();
      }
    } catch (err) {
      // Пользователь закрыл диалог выбора папки — это не ошибка.
      if (!(err instanceof DOMException && err.name === "AbortError")) {
        error = getErrorMessage(err, $t("tree.errors.readFolder"));
        logError("Unexpected error", err);
      }
    } finally {
      isLoading = false;
    }
  }

  async function handleRestoreGithub() {
    if (!hasSavedGithub) return;
    isLoading = true;
    error = null;

    try {
      const restored = await restoreGithubTree();
      if (!restored) {
        error = $t("tree.errors.restore");
      }
    } catch (err) {
      error = getErrorMessage(err, $t("tree.errors.loadRepo"));
      logError("Unexpected error", err);
    } finally {
      isLoading = false;
    }
  }

  async function handleFileInputChange(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    isLoading = true;
    error = null;

    try {
      const { nodes, rootName } = await readDirectoryViaInput(input.files);
      const fileCount = calculateStats(nodes).totalFiles;
      const saved = await setProjectTreeSource({
        rootName,
        nodes,
        fileCount,
      });

      if (saved) {
        await clearGithubConfig();
      }
    } catch (err) {
      error = getErrorMessage(err, $t("tree.errors.readFolder"));
      logError("Unexpected error", err);
    } finally {
      isLoading = false;
      input.value = "";
    }
  }

  async function handleCopy() {
    if (!$projectTreeString) return;
    try {
      await navigator.clipboard.writeText($projectTreeString);
      copied = true;
      setTimeout(() => (copied = false), 2000);
    } catch {
      error = $t("common.copyFailed");
    }
  }

  /** Убирает дерево из проекта. Файлы на диске и в репозитории не трогаем. */
  async function handleRemoveTree() {
    const confirmed = await requestConfirm({
      title: $t("tree.remove.title"),
      message: $t("tree.remove.message", { name: $projectTreeRootName }),
      confirmText: $t("common.delete"),
      cancelText: $t("common.cancel"),
      danger: true,
    });
    if (!confirmed) return;
    try {
      await clearProjectTreeSource();
    } catch (err) {
      error = getErrorMessage(err, $t("tree.remove.failed"));
      logError("Failed to remove project tree", err);
    }
  }

  function handleInsertToEditor() {
    if (!editor || !$projectTreeString) return;
    // Отдельным блоком после текущего абзаца: текст вокруг не трогаем,
    // а уже вставленное дерево обновляем на месте.
    editor.chain().focus().insertProjectTree($projectTreeString).run();
  }
</script>

<div data-tour="tree" class="tree-section mt-1">
  <button
    type="button"
    onclick={() => (isTreeSectionOpen = !isTreeSectionOpen)}
    class="tree-section-header flex w-full items-center gap-1.5 px-4 py-1.5 text-label font-semibold text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-light)]"
  >
    {#if isTreeSectionOpen}
      <ChevronDown size={12} />
    {:else}
      <ChevronRight size={12} />
    {/if}
    <span>{$t("tree.section")}</span>
    <span class="ml-auto font-mono text-micro text-[var(--text-tertiary)]">
      {#if totalFiles > 0}
        {#if selectedCount > 0}
          {selectedCount}/{totalFiles}
        {:else}
          {totalFiles}
        {/if}
      {:else}
        —
      {/if}
    </span>
  </button>

  {#if isTreeSectionOpen}
    <div
      class="flex items-center gap-2.5 border-b border-[var(--border)] px-3 py-1.5"
    >
      <button
        type="button"
        onclick={handlePickDirectory}
        disabled={isLoading}
        class={SECTION_TOOL_BTN}
        title={$t("tree.openFolder")}
        aria-label={$t("tree.openFolder")}
      >
        {#if isLoading}
          <LoaderCircle size={18} class="animate-spin" />
        {:else}
          <FolderOpen size={18} />
        {/if}
      </button>

      <button
        type="button"
        onclick={onOpenGithubModal}
        class={SECTION_TOOL_BTN}
        title={$t("tree.connectGithub")}
        aria-label={$t("tree.connectGithub")}
      >
        <FolderGit size={18} />
      </button>

      {#if hasSavedGithub && $projectTreeNodes.length === 0}
        <button
          type="button"
          onclick={handleRestoreGithub}
          disabled={isLoading}
          class={SECTION_TOOL_BTN}
          title={$t("tree.restoreGithub")}
          aria-label={$t("tree.restoreGithub")}
        >
          <RefreshCw size={18} />
        </button>
      {/if}

      <div class="flex-1"></div>

      {#if $projectTreeNodes.length > 0}
        <div
          class="flex shrink-0 items-center gap-1.5"
          title={$t("prompts.selectAll")}
        >
          <Checkbox
            checked={isAllSelected}
            indeterminate={isPartialSelected}
            onToggle={toggleSelectAll}
            ariaLabel={$t("tree.selectAll")}
          />
          <span
            class="min-w-[1.25rem] text-right font-mono text-micro font-semibold text-[var(--text-tertiary)] tabular-nums"
          >
            {selectedCount > 0 ? selectedCount : ""}
          </span>
        </div>
      {/if}
    </div>

    {#if error}
      <div
        class="mx-3 mt-2 flex items-start gap-2 rounded-md border border-[var(--error)]/40 bg-[var(--error)]/10 px-3 py-2 text-xs text-[var(--error)]"
      >
        <CircleAlert size={14} class="mt-0.5 shrink-0" />
        <span>{error}</span>
      </div>
    {/if}

    {#if $projectTreeNodes.length === 0}
      <!-- Пустая секция — одна строка с действиями (этап 14.4). -->
      <div
        class="m-2 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md border border-dashed border-[var(--border)] py-1.5 pr-1.5 pl-3"
      >
        <FolderTree size={14} class="shrink-0 text-[var(--text-dim)]" />
        <p
          class="min-w-0 flex-1 text-caption font-medium text-[var(--text-tertiary)]"
        >
          {$t("tree.empty")}
        </p>
        <div class="flex shrink-0 items-center">
          <button
            type="button"
            onclick={handlePickDirectory}
            disabled={isLoading}
            class="btn btn-ghost btn-sm"
          >
            <FolderOpen size={14} />
            {$t("tree.openFolderShort")}
          </button>
          <button
            type="button"
            onclick={onOpenGithubModal}
            class="btn btn-ghost btn-sm"
          >
            <FolderGit size={14} />
            GitHub
          </button>
        </div>
      </div>
    {:else}
      <!-- Строка папки: имя и действия над самим деревом (копировать,
           вставить, удалить). Источники — в ряду выше. -->
      <div
        class="flex items-center gap-0.5 border-b border-[var(--border)] bg-[var(--bg-light)] py-1 pr-2 pl-4"
      >
        <span
          class="min-w-0 flex-1 truncate font-mono text-label font-medium text-[var(--text-secondary)]"
          title={$projectTreeRootName}
        >
          {$projectTreeRootName}
        </span>
        <button
          type="button"
          onclick={handleCopy}
          class="{SECTION_TOOL_BTN} {copied ? 'text-[var(--success)]' : ''}"
          title={copied ? $t("common.copiedExclaim") : $t("tree.copy")}
          aria-label={$t("tree.copy")}
        >
          {#if copied}
            <span class="text-caption font-bold">✓</span>
          {:else}
            <Copy size={16} />
          {/if}
        </button>
        <button
          type="button"
          onclick={handleInsertToEditor}
          class={SECTION_TOOL_BTN}
          title={$t("tree.insert")}
          aria-label={$t("tree.insert")}
        >
          <FileInput size={16} />
        </button>
        <button
          type="button"
          onclick={() => void handleRemoveTree()}
          class="{SECTION_TOOL_BTN} hover:!bg-[var(--error)]/10 hover:!text-[var(--error)]"
          title={$t("tree.remove.button")}
          aria-label={$t("tree.remove.button")}
        >
          <Trash2 size={16} />
        </button>
      </div>
      <div class="border-b border-[var(--border)] px-3 py-1.5">
        <div class="flex items-center gap-1.5">
          <input
            type="search"
            bind:value={treeQuery}
            onkeydown={(event) => {
              if (event.key === "Escape" && treeQuery) {
                event.stopPropagation();
                treeQuery = "";
              }
            }}
            placeholder={$t("tree.searchPlaceholder")}
            aria-label={$t("tree.search")}
            class="input input-sm flex-1"
          />
          <!-- Фильтр выбора (10.6): .gitignore + пресеты + свои правила. -->
          <TreeFilterPopover />
        </div>
        {#if filtered}
          <p
            class="mt-1 text-caption text-[var(--text-tertiary)]"
            role="status"
          >
            {filtered.matches > 0
              ? $t("tree.found", { count: filtered.matches })
              : $t("common.nothingFound")}
          </p>
        {/if}
      </div>
      <div class="py-1">
        {#each visibleNodes as node (node.path)}
          <TreeNodeItem
            {node}
            depth={0}
            {editor}
            forceOpen={!!filtered}
            filteredPaths={$filteredTreePathSet}
          />
        {/each}
      </div>
    {/if}
  {/if}

  <input
    bind:this={fileInput}
    type="file"
    multiple
    class="hidden"
    onchange={handleFileInputChange}
    use:directoryPicker
  />
</div>
