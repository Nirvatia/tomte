<!-- ProjectTreeSidebar.svelte -->
<script lang="ts">
  import { browser } from "$app/environment";
  import { onMount } from "svelte";
  import {
    X,
    FolderTree,
    Copy,
    FileInput,
    FolderOpen,
    LoaderCircle,
    CircleAlert,
    SquareCheck,
    Square,
    FolderGit,
    RefreshCw,
  } from "@lucide/svelte";
  import {
    isProjectTreeOpen,
    projectTreeNodes,
    projectTreeRootName,
    projectTreeString,
    selectedProjectFiles,
    previewFileFromTree,
  } from "../../stores";
  import {
    readDirectoryRecursive,
    readDirectoryViaInput,
    buildTreeString,
    calculateStats,
    hasFileSystemAccess,
  } from "../../utils/projectTree";
  import {
    parseGithubUrl,
    fetchGithubTree,
    type GithubRepoConfig,
  } from "../../utils/github";
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
  function handleModalBackdropKeydown(e: KeyboardEvent) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      isGithubModalOpen = false;
    }
  }
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
  let stats = $derived(
    $projectTreeNodes.length === 0 ? null : calculateStats($projectTreeNodes),
  );
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
        projectTreeNodes.set(nodes);
        projectTreeRootName.set(dirHandle.name);
        projectTreeString.set(buildTreeString(dirHandle.name, nodes));
        selectedProjectFiles.set([]);
        await saveProjectSource({ type: "handle", handle: dirHandle });
        hasSavedGithub = false;
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
      await clearProjectSource();
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
      await saveProjectSource({
        type: "files",
        files: Array.from(input.files),
        rootName,
      });
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
    editor
      .chain()
      .focus()
      .setCodeBlock()
      .insertContent($projectTreeString)
      .run();
  }
  function handleClose() {
    isProjectTreeOpen.set(false);
  }
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

<aside
  class="shrink-0 overflow-hidden transition-all duration-300 ease-out {$isProjectTreeOpen
    ? 'w-100'
    : 'w-0'}"
>
  <div class="flex h-full w-100 flex-col border-r border-line bg-panel">
    <!-- Заголовок -->
    <div
      class="flex shrink-0 items-center justify-between border-b border-line bg-raised p-4"
    >
      <div class="flex items-center gap-2">
        <FolderTree size={19} class="text-amb" />
        <h2 class="font-bold text-txt">Структура проекта</h2>
      </div>
      <button
        type="button"
        onclick={handleClose}
        class="rounded-lg p-2 text-txt2 transition-colors hover:bg-raised2 hover:text-txt"
        aria-label="Закрыть панель структуры проекта"
      >
        <X size={18} />
      </button>
    </div>

    <div class="min-h-0 flex-1 overflow-y-auto">
      {#if $projectTreeNodes.length === 0}
        <!-- ═══ Режим онбординга: дерево пустое ═══ -->
        <div class="border-b border-line p-4">
          <div
            class="mb-3 font-mono text-[10px] font-semibold uppercase tracking-wider text-txt3"
          >
            Источник
          </div>
          <div class="space-y-2">
            <button
              type="button"
              onclick={handlePickDirectory}
              disabled={isLoading}
              class="inline-flex w-full items-center justify-center gap-2 rounded-md bg-amb px-4 py-2.5 font-mono text-xs font-bold uppercase tracking-wider text-[#16130c] shadow-[0_2px_14px_rgba(255,160,40,0.22)] transition-colors hover:brightness-105 disabled:pointer-events-none disabled:opacity-50"
            >
              {#if isLoading}
                <LoaderCircle size={15} class="animate-spin" />
                <span>Чтение...</span>
              {:else}
                <FolderOpen size={15} />
                <span>Выбрать папку</span>
              {/if}
            </button>
            <button
              type="button"
              onclick={() => (isGithubModalOpen = true)}
              class="inline-flex w-full items-center justify-center gap-2 rounded-md border border-line bg-raised px-4 py-2.5 text-sm font-medium text-txt2 transition-colors hover:bg-raised2 hover:text-txt"
            >
              <FolderGit size={15} />
              <span>Подключить GitHub</span>
            </button>
            {#if hasSavedGithub && $projectTreeNodes.length === 0}
              <button
                type="button"
                onclick={handleRestoreGithub}
                class="inline-flex w-full items-center justify-center gap-2 rounded-md border border-line bg-raised2 px-4 py-2.5 text-sm font-medium text-txt transition-colors hover:bg-[#383a41]"
              >
                <RefreshCw size={15} />
                <span>Восстановить GitHub репо</span>
              </button>
            {/if}
          </div>
        </div>

        <div class="px-4 pb-10 pt-12 text-center">
          <div
            class="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-xl border border-line bg-raised"
          >
            <FolderTree size={26} class="text-txt3" />
          </div>
          <p class="text-sm font-medium text-txt2">Дерево структуры не создано</p>
          <p class="mx-auto mt-1.5 max-w-60 text-xs text-txt3">
            Выберите локальную папку или подключите GitHub-репозиторий
          </p>
        </div>
      {:else}
        <!-- ═══ Рабочий режим: дерево загружено ═══ -->
        <div class="border-b border-line p-3">
          <div
            class="mb-2 font-mono text-[10px] font-semibold uppercase tracking-wider text-txt3"
          >
            Источник
          </div>
          <div class="flex gap-2">
            <button
              type="button"
              onclick={handlePickDirectory}
              disabled={isLoading}
              class="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md border border-line bg-raised px-3 text-xs font-medium text-txt2 transition-colors hover:bg-raised2 hover:text-txt disabled:pointer-events-none disabled:opacity-50"
            >
              {#if isLoading}
                <LoaderCircle size={13} class="animate-spin" />
                <span>Чтение...</span>
              {:else}
                <FolderOpen size={13} />
                <span>Папка</span>
              {/if}
            </button>
            <button
              type="button"
              onclick={() => (isGithubModalOpen = true)}
              class="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md border border-line bg-raised px-3 text-xs font-medium text-txt2 transition-colors hover:bg-raised2 hover:text-txt"
            >
              <FolderGit size={13} />
              <span>GitHub</span>
            </button>
          </div>
        </div>

        {#if $projectTreeString}
          <div class="border-b border-line p-3">
            <div
              class="mb-2 font-mono text-[10px] font-semibold uppercase tracking-wider text-txt3"
            >
              Экспорт дерева
            </div>
            <div class="flex gap-2">
              <button
                type="button"
                onclick={handleCopy}
                class="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md border border-line bg-raised px-3 text-xs font-medium text-txt2 transition-colors hover:bg-raised2 hover:text-txt"
              >
                {#if copied}
                  <span class="font-medium text-ok">✓ Скопировано</span>
                {:else}
                  <Copy size={13} /><span>Копировать</span>
                {/if}
              </button>
              <button
                type="button"
                onclick={handleInsertToEditor}
                class="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md border border-ok/30 bg-ok/10 px-3 text-xs font-medium text-ok transition-colors hover:bg-ok/20"
              >
                <FileInput size={13} /><span>В редактор</span>
              </button>
            </div>
          </div>
        {/if}
      {/if}

      {#if error}
        <div
          class="mx-3 mt-3 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600"
        >
          <CircleAlert size={14} class="mt-0.5 shrink-0" /><span>{error}</span>
        </div>
      {/if}

      {#if $projectTreeNodes.length > 0}
        <!-- Статистика + выбор: одна строка -->
        <div
          class="flex items-center justify-between gap-2 border-b border-line bg-raised px-3 py-2"
        >
          <div class="flex items-center gap-2 font-mono text-xs text-txt3">
            <span
              ><strong class="font-semibold text-txt">{stats?.totalFiles}</strong>
              файлов</span
            >
            <span class="text-line2">·</span>
            <span
              ><strong class="font-semibold text-txt">{stats?.totalDirs}</strong>
              папок</span
            >
            {#if $selectedProjectFiles.length > 0}
              <span class="text-line2">·</span>
              <span class="font-semibold text-amb2"
                >{$selectedProjectFiles.length} выбрано</span
              >
            {/if}
          </div>
          <div class="flex shrink-0 gap-1.5">
            <button
              type="button"
              onclick={selectAll}
              class="inline-flex items-center gap-1 rounded border border-line bg-panel px-2 py-1 text-xs text-txt2 transition-colors hover:bg-raised2 hover:text-txt"
              title="Выбрать все файлы"
            >
              <SquareCheck size={12} /><span>Все</span>
            </button>
            <button
              type="button"
              onclick={deselectAll}
              class="inline-flex items-center gap-1 rounded border border-line bg-panel px-2 py-1 text-xs text-txt2 transition-colors hover:bg-raised2 hover:text-txt"
              title="Снять выделение"
            >
              <Square size={12} /><span>Снять</span>
            </button>
          </div>
        </div>

        <!-- Дерево -->
        <div class="p-2">
          {#each $projectTreeNodes as node}
            <TreeNodeItem {node} depth={0} {editor} />
          {/each}
        </div>
      {/if}
    </div>

    <input
      bind:this={fileInput}
      type="file"
      multiple
      class="hidden"
      onchange={handleFileInputChange}
      use:directoryPicker
    />
  </div>

  <FilePreviewModal
    file={$previewFileFromTree}
    onClose={() => previewFileFromTree.set(null)}
  />

  <!-- Модальное окно подключения GitHub -->
  {#if isGithubModalOpen}
    <div
      class="fixed inset-0 z-50 flex animate-fade-in items-center justify-center bg-black/60 p-4 backdrop-blur-[2px]"
      role="button"
      tabindex="0"
      onclick={() => (isGithubModalOpen = false)}
      onkeydown={handleModalBackdropKeydown}
      aria-label="Закрыть окно подключения GitHub"
    >
      <div
        class="w-full max-w-md rounded-xl border border-line2 bg-panel p-6 shadow-deep"
        role="presentation"
        onclick={(e) => e.stopPropagation()}
      >
        <div class="mb-4 flex items-center justify-between">
          <h3 class="flex items-center gap-2 text-lg font-bold text-txt">
            <FolderGit size={20} class="text-amb" />
            Подключить GitHub
          </h3>
          <button
            type="button"
            onclick={() => (isGithubModalOpen = false)}
            class="rounded p-1 text-txt2 transition-colors hover:bg-raised2 hover:text-txt"
            aria-label="Закрыть"
          >
            <X size={18} />
          </button>
        </div>

        <div class="space-y-4">
          <div>
            <label
              for="github-url"
              class="mb-1.5 block font-mono text-[11px] font-semibold uppercase tracking-wider text-txt3"
              >URL репозитория</label
            >
            <input
              id="github-url"
              bind:value={githubUrl}
              placeholder="https://github.com/owner/repo"
              class="w-full rounded-md border border-line bg-inset px-3 py-2 text-sm text-txt transition-all placeholder:text-txt3 focus:border-amb/60 focus:outline-none focus:ring-2 focus:ring-amb/15"
            />
          </div>
          <div>
            <label
              for="github-branch"
              class="mb-1.5 block font-mono text-[11px] font-semibold uppercase tracking-wider text-txt3"
              >Ветка (branch)</label
            >
            <input
              id="github-branch"
              bind:value={githubBranch}
              placeholder="main"
              class="w-full rounded-md border border-line bg-inset px-3 py-2 text-sm text-txt transition-all placeholder:text-txt3 focus:border-amb/60 focus:outline-none focus:ring-2 focus:ring-amb/15"
            />
          </div>
          <div>
            <label
              for="github-token"
              class="mb-1.5 block font-mono text-[11px] font-semibold uppercase tracking-wider text-txt3"
            >
              Personal Access Token
              <span class="normal-case tracking-normal text-txt3/70"
                >(опционально, для приватных)</span
              >
            </label>
            <input
              id="github-token"
              bind:value={githubToken}
              type="password"
              placeholder="ghp_xxxxxxxxxxxx"
              class="w-full rounded-md border border-line bg-inset px-3 py-2 font-mono text-sm text-txt transition-all placeholder:text-txt3 focus:border-amb/60 focus:outline-none focus:ring-2 focus:ring-amb/15"
            />
          </div>
          <button
            type="button"
            onclick={handleConnectGithub}
            disabled={isLoading || !githubUrl}
            class="flex w-full items-center justify-center gap-2 rounded-md bg-amb py-2.5 font-mono text-xs font-bold uppercase tracking-wider text-[#16130c] transition-colors hover:brightness-105 disabled:opacity-50"
          >
            {#if isLoading}
              <LoaderCircle size={15} class="animate-spin" />
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