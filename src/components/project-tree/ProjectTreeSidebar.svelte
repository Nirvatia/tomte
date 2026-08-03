<script lang="ts">
  import { browser } from "$app/environment";
  import { onMount } from "svelte";
  import { X, FolderTree, Copy, FileInput, FolderOpen, Loader2, AlertCircle, CheckSquare, Square, FolderGit, RefreshCw } from "@lucide/svelte";
  import { isProjectTreeOpen, projectTreeNodes, projectTreeRootName, projectTreeString, selectedProjectFiles, previewFileFromTree } from "../../stores";
  import { readDirectoryRecursive, readDirectoryViaInput, buildTreeString, calculateStats, hasFileSystemAccess } from "../../utils/projectTree";
  import { parseGithubUrl, fetchGithubTree, type GithubRepoConfig } from "../../utils/github";
  import { saveProjectSource, clearProjectSource } from "../../utils/draft";
  import type { Editor } from "@tiptap/core";
  import { directoryPicker } from "$lib/actions/directoryPicker";
  import TreeNodeItem from "./TreeNodeItem.svelte";
  import FilePreviewModal from "../attachments/FilePreviewModal.svelte";

  let { editor = null }: { editor?: Editor | null } = $props();

  let isLoading = $state(false);
  let error = $state<string | null>(null);
  let copied = $state(false);
  let fileInput: HTMLInputElement;
  let supportsFileSystem = $state(false);
  let treeStateInitialized = $state(false);

  // Состояние для GitHub модалки
  let isGithubModalOpen = $state(false);
  let githubUrl = $state("");
  let githubBranch = $state("main");
  let githubToken = $state("");
  let hasSavedGithub = $state(false);

  onMount(() => {
    if (!browser) return;
    const saved = localStorage.getItem("projectTreeOpen");
    if (saved !== null) {
      isProjectTreeOpen.set(saved === "true");
    }
    treeStateInitialized = true;

    // Проверка сохраненного GitHub репо
    const savedGithub = localStorage.getItem("tomte_github_config");
    if (savedGithub) {
      try {
        const config: GithubRepoConfig = JSON.parse(savedGithub);
        hasSavedGithub = true;
        githubUrl = `https://github.com/${config.owner}/${config.repo}`;
        githubBranch = config.branch;
        githubToken = config.token || "";
      } catch (e) {
        console.error("Failed to parse saved GitHub config", e);
      }
    }
  });

  $effect(() => {
    if (!browser || !treeStateInitialized) return;
    localStorage.setItem("projectTreeOpen", String($isProjectTreeOpen));
  });

  $effect(() => {
    if (browser) supportsFileSystem = hasFileSystemAccess();
  });

  let stats = $derived($projectTreeNodes.length === 0 ? null : calculateStats($projectTreeNodes));

  function getAllFilePaths(nodes: typeof $projectTreeNodes): string[] {
    const paths: string[] = [];
    function traverse(items: typeof $projectTreeNodes) {
      for (const item of items) {
        if (item.type === "file") paths.push(item.path);
        else traverse(item.children);
      }
    }
    traverse(nodes);
    return paths;
  }

  function selectAll() { selectedProjectFiles.set(getAllFilePaths($projectTreeNodes)); }
  function deselectAll() { selectedProjectFiles.set([]); }

  async function handlePickDirectory() {
    error = null;
    isLoading = true;
    try {
      if (supportsFileSystem) {
        const dirHandle = await (window as any).showDirectoryPicker({ mode: "read" });
        const nodes = await readDirectoryRecursive(dirHandle);
        projectTreeNodes.set(nodes);
        projectTreeRootName.set(dirHandle.name);
        projectTreeString.set(buildTreeString(dirHandle.name, nodes));
        selectedProjectFiles.set([]);
        await saveProjectSource({ type: "handle", handle: dirHandle });
        hasSavedGithub = false; // Сбрасываем флаг GitHub при выборе локальной папки
      } else {
        fileInput?.click();
      }
    } catch (e: any) {
      if (e.name !== "AbortError") {
        error = e.message || "Не удалось прочитать папку";
        console.error(e);
      }
    } finally {
      isLoading = false;
    }
  }

  async function handleConnectGithub() {
    const parsed = parseGithubUrl(githubUrl);
    if (!parsed) {
      error = "Неверный URL репозитория. Пример: https://github.com/owner/repo";
      return;
    }

    error = null;
    isLoading = true;
    isGithubModalOpen = false;

    try {
      const config: GithubRepoConfig = {
        owner: parsed.owner,
        repo: parsed.repo,
        branch: githubBranch || "main",
        token: githubToken.trim() || undefined,
      };

      const nodes = await fetchGithubTree(config);
      
      projectTreeNodes.set(nodes);
      projectTreeRootName.set(parsed.repo);
      projectTreeString.set(buildTreeString(parsed.repo, nodes));
      selectedProjectFiles.set([]);
      
      // Очищаем локальный драфт, так как теперь источник - GitHub
      await clearProjectSource();

      // Сохраняем в localStorage для восстановления
      localStorage.setItem("tomte_github_config", JSON.stringify(config));
      hasSavedGithub = true;

    } catch (e: any) {
      error = e.message || "Не удалось загрузить репозиторий";
      console.error(e);
    } finally {
      isLoading = false;
    }
  }

  async function handleRestoreGithub() {
    if (!hasSavedGithub) return;
    await handleConnectGithub();
  }

  async function handleFileInputChange(e: Event) {
    const input = e.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    isLoading = true;
    error = null;
    try {
      const { nodes, rootName } = await readDirectoryViaInput(input.files);
      projectTreeNodes.set(nodes);
      projectTreeRootName.set(rootName);
      projectTreeString.set(buildTreeString(rootName, nodes));
      selectedProjectFiles.set([]);
      await saveProjectSource({ type: "files", files: Array.from(input.files), rootName });
      hasSavedGithub = false;
    } catch (e: any) {
      error = e.message || "Не удалось прочитать папку";
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
    } catch (e) {
      error = "Не удалось скопировать";
    }
  }

  function handleInsertToEditor() {
    if (!editor || !$projectTreeString) return;
    editor.chain().focus().setCodeBlock().insertContent($projectTreeString).run();
  }

  function handleClose() { isProjectTreeOpen.set(false); }
  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      if (isGithubModalOpen) {
        isGithubModalOpen = false;
      } else if ($isProjectTreeOpen) {
        handleClose();
      }
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<aside class="transition-all duration-300 ease-out overflow-hidden {$isProjectTreeOpen ? 'w-100' : 'w-0'} shrink-0">
  <div class="w-100 h-full flex flex-col bg-surface border-r border-slate-200">
    <div class="flex items-center justify-between p-4 border-b border-slate-100 bg-surface-secondary shrink-0">
      <div class="flex items-center gap-2">
        <FolderTree size={20} class="text-brand-500" />
        <h2 class="font-bold text-ink">Структура проекта</h2>
      </div>
      <button onclick={handleClose} class="p-2 rounded-lg hover:bg-surface-tertiary text-ink-secondary hover:text-ink transition-colors" aria-label="Закрыть">
        <X size={18} />
      </button>
    </div>

    <div class="p-4 border-b border-slate-100 space-y-2 shrink-0">
      <button onclick={handlePickDirectory} disabled={isLoading} class="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-brand-500 text-white rounded-lg font-medium text-sm hover:bg-brand-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
        {#if isLoading}<Loader2 size={16} class="animate-spin" /><span>Чтение...</span>
        {:else}<FolderOpen size={16} /><span>Выбрать папку</span>{/if}
      </button>

      <button onclick={() => isGithubModalOpen = true} class="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 text-white rounded-lg font-medium text-sm hover:bg-slate-700 transition-all">
        <FolderGit size={16} />
        <span>Подключить GitHub</span>
      </button>

      {#if hasSavedGithub && $projectTreeNodes.length === 0}
        <button onclick={handleRestoreGithub} class="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-surface-tertiary text-ink rounded-lg font-medium text-sm hover:bg-slate-200 transition-all border border-slate-200">
          <RefreshCw size={16} />
          <span>Восстановить GitHub репо</span>
        </button>
      {/if}

      {#if $projectTreeString}
        <div class="flex gap-2">
          <button onclick={handleCopy} class="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 bg-surface-tertiary text-ink rounded-lg text-sm hover:bg-slate-200 transition-colors">
            {#if copied}<span class="text-emerald-600">✓ Скопировано</span>
            {:else}<Copy size={14} /><span>Копировать</span>{/if}
          </button>
          <button onclick={handleInsertToEditor} class="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 bg-emerald-50 text-emerald-700 rounded-lg text-sm hover:bg-emerald-100 transition-colors border border-emerald-200">
            <FileInput size={14} /><span>В редактор</span>
          </button>
        </div>
      {/if}
    </div>

    {#if stats}
      <div class="px-4 py-2 border-b border-slate-100 bg-surface-secondary shrink-0">
        <div class="text-xs text-ink-tertiary flex items-center gap-3 mb-2">
          <span><strong class="text-ink">{stats.totalFiles}</strong> файлов</span>
          <span class="text-slate-300">|</span>
          <span><strong class="text-ink">{stats.totalDirs}</strong> папок</span>
          {#if $selectedProjectFiles.length > 0}
            <span class="text-slate-300">|</span>
            <span class="text-brand-600 font-semibold">{$selectedProjectFiles.length} выбрано</span>
          {/if}
        </div>
        {#if $projectTreeNodes.length > 0}
          <div class="flex gap-1.5">
            <button onclick={selectAll} class="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1 bg-surface-tertiary text-ink-secondary rounded text-xs hover:bg-slate-200 transition-colors">
              <CheckSquare size={12} /><span>Все</span>
            </button>
            <button onclick={deselectAll} class="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1 bg-surface-tertiary text-ink-secondary rounded text-xs hover:bg-slate-200 transition-colors">
              <Square size={12} /><span>Снять</span>
            </button>
          </div>
        {/if}
      </div>
    {/if}

    {#if error}
      <div class="mx-4 mt-4 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600 flex items-start gap-2 shrink-0">
        <AlertCircle size={14} class="shrink-0 mt-0.5" /><span>{error}</span>
      </div>
    {/if}

    <div class="flex-1 overflow-auto p-2 min-h-0">
      {#if $projectTreeNodes.length === 0}
        <div class="text-center py-16 text-ink-tertiary px-4">
          <FolderTree size={48} class="mx-auto mb-4 opacity-30" />
          <p class="text-sm font-medium">Дерево структуры не создано</p>
          <p class="text-xs mt-2">Выберите локальную папку или подключите GitHub</p>
        </div>
      {:else}
        <div class="font-sans text-sm">
          {#each $projectTreeNodes as node}
            <TreeNodeItem {node} depth={0} {editor} />
          {/each}
        </div>
      {/if}
    </div>

    <input bind:this={fileInput} type="file" multiple class="hidden" onchange={handleFileInputChange} use:directoryPicker />
  </div>

  <FilePreviewModal file={$previewFileFromTree} onClose={() => previewFileFromTree.set(null)} />

  <!-- Модальное окно подключения GitHub -->
  {#if isGithubModalOpen}
    <div class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in" onclick={() => isGithubModalOpen = false}>
      <div class="bg-surface rounded-2xl shadow-2xl max-w-md w-full p-6" onclick={(e) => e.stopPropagation()}>
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-bold text-ink flex items-center gap-2">
            <FolderGit size={20} class="text-slate-800" />
            Подключить GitHub
          </h3>
          <button onclick={() => isGithubModalOpen = false} class="p-1 rounded hover:bg-surface-tertiary">
            <X size={18} />
          </button>
        </div>

        <div class="space-y-4">
          <div>
            <label class="block text-xs font-medium text-ink-secondary mb-1">URL репозитория</label>
            <input 
              bind:value={githubUrl} 
              placeholder="https://github.com/owner/repo" 
              class="w-full px-3 py-2 bg-surface-tertiary border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30"
            />
          </div>
          
          <div>
            <label class="block text-xs font-medium text-ink-secondary mb-1">Ветка (branch)</label>
            <input 
              bind:value={githubBranch} 
              placeholder="main" 
              class="w-full px-3 py-2 bg-surface-tertiary border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30"
            />
          </div>

          <div>
            <label class="block text-xs font-medium text-ink-secondary mb-1">
              Personal Access Token <span class="text-ink-tertiary">(опционально, для приватных)</span>
            </label>
            <input 
              bind:value={githubToken} 
              type="password"
              placeholder="ghp_xxxxxxxxxxxx" 
              class="w-full px-3 py-2 bg-surface-tertiary border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30"
            />
          </div>

          <button 
            onclick={handleConnectGithub} 
            disabled={isLoading || !githubUrl}
            class="w-full py-2.5 bg-slate-800 text-white rounded-lg font-medium text-sm hover:bg-slate-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {#if isLoading}
              <Loader2 size={16} class="animate-spin" />
              <span>Загрузка...</span>
            {:else}
              <span>Подключить</span>
            {/if}
          </button>
        </div>
      </div>
    </div>
  {/if}
</aside>