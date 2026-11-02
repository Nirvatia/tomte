<script lang="ts">
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
  } from "@lucide/svelte";

  import type { Editor } from "@tiptap/core";

  import Checkbox from "../ui/Checkbox.svelte";
  import TreeNodeItem from "./TreeNodeItem.svelte";

  import {
    activeProject,
    projectTreeNodes,
    projectTreeRootName,
    projectTreeString,
    selectedProjectFiles,
  } from "../../stores";

  import {
    clearGithubConfig,
    restoreGithubTree,
    setProjectTreeSource,
  } from "../../utils/projectActions";
  import {
    calculateStats,
    filterTree,
    hasFileSystemAccess,
    readDirectoryRecursive,
    readDirectoryViaInput,
  } from "../../utils/projectTree";

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

  const totalFiles = $derived(stats?.totalFiles ?? 0);
  const selectedCount = $derived($selectedProjectFiles.length);
  const selectedVisible = $derived(
    visiblePaths.filter((p) => $selectedProjectFiles.includes(p)).length,
  );
  const isAllSelected = $derived(
    visiblePaths.length > 0 && selectedVisible === visiblePaths.length,
  );
  const isPartialSelected = $derived(
    selectedVisible > 0 && selectedVisible < visiblePaths.length,
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
      ...new Set([...current, ...visiblePaths]),
    ]);
  }

  function deselectAll() {
    const visible = new Set(visiblePaths);
    selectedProjectFiles.update((current) =>
      current.filter((path) => !visible.has(path)),
    );
  }

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
        console.error(err);
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
      console.error(err);
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
      console.error(err);
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

  function handleInsertToEditor() {
    if (!editor || !$projectTreeString) return;
    // Отдельным блоком после текущего абзаца: текст вокруг не трогаем,
    // а уже вставленное дерево обновляем на месте.
    editor.chain().focus().insertProjectTree($projectTreeString).run();
  }
</script>

<div class="tree-section mt-1">
  <button
    type="button"
    onclick={() => (isTreeSectionOpen = !isTreeSectionOpen)}
    class="tree-section-header flex w-full items-center gap-1.5 px-4 py-1.5 text-[12px] font-semibold text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-light)]"
  >
    {#if isTreeSectionOpen}
      <ChevronDown size={12} />
    {:else}
      <ChevronRight size={12} />
    {/if}
    <span>{$t("tree.section")}</span>
    <span class="ml-auto font-mono text-[10px] text-[var(--text-tertiary)]">
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

      {#if $projectTreeString}
        <button
          type="button"
          onclick={handleCopy}
          class="{SECTION_TOOL_BTN} {copied ? 'text-[var(--success)]' : ''}"
          title={copied ? $t("common.copiedExclaim") : $t("tree.copy")}
          aria-label={$t("tree.copy")}
        >
          {#if copied}
            <span class="text-[11px] font-bold">✓</span>
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

        <div class="mx-1 h-4 w-px shrink-0 bg-[var(--border)]"></div>
      {/if}

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
            class="min-w-[1.25rem] text-right font-mono text-[10px] font-semibold text-[var(--text-tertiary)] tabular-nums"
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
      <div class="px-4 py-6 text-center">
        <FolderTree size={24} class="mx-auto mb-2 text-[var(--text-dim)]" />
        <p class="text-xs font-medium text-[var(--text-tertiary)]">
          {$t("tree.empty")}
        </p>
        <p class="mt-1 text-[11px] leading-relaxed text-[var(--text-tertiary)]">
          {$t("tree.emptyHint")}
        </p>
      </div>
    {:else}
      <div
        class="truncate border-b border-[var(--border)] bg-[var(--bg-light)] px-4 py-1.5 font-mono text-[12px] font-medium text-[var(--text-secondary)]"
        title={$projectTreeRootName}
      >
        {$projectTreeRootName}
      </div>
      <div class="border-b border-[var(--border)] px-3 py-1.5">
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
          class="w-full rounded border border-[var(--border)] bg-[var(--bg-darkest)] px-2 py-1 text-[12px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent)] focus:outline-none"
        />
        {#if filtered}
          <p class="mt-1 text-[11px] text-[var(--text-tertiary)]" role="status">
            {filtered.matches > 0
              ? $t("tree.found", { count: filtered.matches })
              : $t("common.nothingFound")}
          </p>
        {/if}
      </div>
      <div class="py-1">
        {#each visibleNodes as node (node.path)}
          <TreeNodeItem {node} depth={0} {editor} forceOpen={!!filtered} />
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
