<script lang="ts">
  import { browser } from "$app/environment";
  import { X, FolderTree, Copy, FileInput, FolderOpen, Loader2, AlertCircle, CheckSquare, Square } from "@lucide/svelte";
  import { isProjectTreeOpen, projectTreeNodes, projectTreeRootName, projectTreeString, selectedProjectFiles, previewFileFromTree } from "../../stores";
  import { readDirectoryRecursive, readDirectoryViaInput, buildTreeString, calculateStats, hasFileSystemAccess } from "../../utils/projectTree";
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
        // Просто вызываем функцию, handle уже внутри узлов
        const nodes = await readDirectoryRecursive(dirHandle);
        projectTreeNodes.set(nodes);
        projectTreeRootName.set(dirHandle.name);
        projectTreeString.set(buildTreeString(dirHandle.name, nodes));
        selectedProjectFiles.set([]);
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
    if (e.key === "Escape" && $isProjectTreeOpen) handleClose();
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
          <p class="text-xs mt-2">Нажмите "Выбрать папку" выше, чтобы сгенерировать дерево проекта</p>
        </div>
      {:else}
        <div class="font-sans text-sm">
          {#each $projectTreeNodes as node}
            <TreeNodeItem {node} depth={0} />
          {/each}
        </div>
      {/if}
    </div>

    <input bind:this={fileInput} type="file" multiple class="hidden" onchange={handleFileInputChange} use:directoryPicker />
  </div>

  <FilePreviewModal file={$previewFileFromTree} onClose={() => previewFileFromTree.set(null)} />
</aside>