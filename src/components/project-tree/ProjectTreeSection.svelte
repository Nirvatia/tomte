<script lang="ts">
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
    hasFileSystemAccess,
    readDirectoryRecursive,
    readDirectoryViaInput,
  } from "../../utils/projectTree";

  import { SECTION_TOOL_BTN } from "./constants";

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

  const totalFiles = $derived(stats?.totalFiles ?? 0);
  const selectedCount = $derived($selectedProjectFiles.length);
  const isAllSelected = $derived(
    totalFiles > 0 && selectedCount === totalFiles,
  );
  const isPartialSelected = $derived(
    totalFiles > 0 && selectedCount > 0 && selectedCount < totalFiles,
  );

  function toggleSelectAll() {
    if (isAllSelected) {
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
    selectedProjectFiles.set(getAllFilePaths($projectTreeNodes));
  }

  function deselectAll() {
    selectedProjectFiles.set([]);
  }

  async function handlePickDirectory() {
    error = null;
    isLoading = true;

    try {
      if (supportsFileSystem) {
        const dirHandle = await (window as any).showDirectoryPicker({
          mode: "read",
        });
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
    } catch (err: any) {
      if (err.name !== "AbortError") {
        error = err.message || "Не удалось прочитать папку";
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
        error = "Не удалось восстановить репозиторий";
      }
    } catch (err: any) {
      error = err.message || "Не удалось загрузить репозиторий";
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
    } catch (err: any) {
      error = err.message || "Не удалось прочитать папку";
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
    } catch (err) {
      error = "Не удалось скопировать";
    }
  }

  function handleInsertToEditor() {
    if (!editor || !$projectTreeString) return;
    editor
      .chain()
      .focus()
      .setCodeBlock()
      .insertContent($projectTreeString)
      .run();
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
    <span>Project</span>
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
      class="flex items-center gap-0.5 border-b border-[var(--border)] px-3 py-1.5"
    >
      <button
        type="button"
        onclick={handlePickDirectory}
        disabled={isLoading}
        class={SECTION_TOOL_BTN}
        title="Открыть папку"
        aria-label="Открыть папку"
      >
        {#if isLoading}
          <LoaderCircle size={16} class="animate-spin" />
        {:else}
          <FolderOpen size={16} />
        {/if}
      </button>

      <button
        type="button"
        onclick={onOpenGithubModal}
        class={SECTION_TOOL_BTN}
        title="Подключить GitHub"
        aria-label="Подключить GitHub"
      >
        <FolderGit size={16} />
      </button>

      {#if hasSavedGithub && $projectTreeNodes.length === 0}
        <button
          type="button"
          onclick={handleRestoreGithub}
          disabled={isLoading}
          class={SECTION_TOOL_BTN}
          title="Восстановить GitHub репо"
          aria-label="Восстановить GitHub репо"
        >
          <RefreshCw size={16} />
        </button>
      {/if}

      <div class="flex-1"></div>

      {#if $projectTreeString}
        <button
          type="button"
          onclick={handleCopy}
          class="{SECTION_TOOL_BTN} {copied ? 'text-[var(--success)]' : ''}"
          title={copied ? "Скопировано!" : "Копировать дерево"}
          aria-label="Копировать дерево"
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
          title="Вставить дерево в редактор"
          aria-label="Вставить дерево в редактор"
        >
          <FileInput size={16} />
        </button>

        <div class="mx-1 h-4 w-px shrink-0 bg-[var(--border)]"></div>
      {/if}

      {#if $projectTreeNodes.length > 0}
        <div
          class="flex shrink-0 items-center gap-1.5"
          title="Выбрать все файлы"
        >
          <Checkbox
            checked={isAllSelected}
            indeterminate={isPartialSelected}
            onToggle={toggleSelectAll}
            ariaLabel="Выбрать все файлы дерева"
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
          Дерево не создано
        </p>
        <p class="mt-1 text-[11px] leading-relaxed text-[var(--text-dim)]">
          Откройте папку или подключите GitHub-репозиторий
        </p>
      </div>
    {:else}
      <div
        class="truncate border-b border-[var(--border)] bg-[var(--bg-light)] px-4 py-1.5 font-mono text-[12px] font-medium text-[var(--text-secondary)]"
        title={$projectTreeRootName}
      >
        {$projectTreeRootName}
      </div>
      <div class="py-1">
        {#each $projectTreeNodes as node (node.path)}
          <TreeNodeItem {node} depth={0} {editor} />
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
