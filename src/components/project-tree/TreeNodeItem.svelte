<script lang="ts">
  import { Folder, FileText, ChevronRight, ChevronDown, Eye, Link } from "@lucide/svelte";
  import type { TreeNode } from "../../utils/projectTree";
  import type { Editor } from "@tiptap/core";
  import TreeNodeItem from "./TreeNodeItem.svelte";
  import { selectedProjectFiles, previewFileFromTree } from "../../stores";

  let { node, depth = 0, editor = null }: { node: TreeNode; depth?: number; editor?: Editor | null } = $props();
  let isOpen = $state(node.type === "directory");

  function getAllFilePaths(n: TreeNode): string[] {
    if (n.type === "file") return [n.path];
    return n.children.flatMap(getAllFilePaths);
  }

  let isSelected = $derived(
    node.type === "file"
      ? $selectedProjectFiles.includes(node.path)
      : getAllFilePaths(node).every((p) => $selectedProjectFiles.includes(p)) && getAllFilePaths(node).length > 0
  );

  let isPartial = $derived(
    node.type === "directory" &&
      !isSelected &&
      getAllFilePaths(node).some((p) => $selectedProjectFiles.includes(p))
  );

  function toggleSelect(e: Event) {
    e.stopPropagation();
    const paths = node.type === "file" ? [node.path] : getAllFilePaths(node);
    if (isSelected) {
      selectedProjectFiles.update((current) => current.filter((p) => !paths.includes(p)));
    } else {
      selectedProjectFiles.update((current) => {
        const set = new Set(current);
        for (const p of paths) set.add(p);
        return Array.from(set);
      });
    }
  }

  // ЧТЕНИЕ ПО ЗАПРОСУ
  async function handlePreview(e: Event) {
    e.stopPropagation();
    if (node.type !== "file" || !node.fileRef) return;

    try {
      let content = "";
      let size = 0;

      if (node.fileRef instanceof File) {
        content = await node.fileRef.text();
        size = node.fileRef.size;
      } else {
        const file = await (node.fileRef as FileSystemFileHandle).getFile();
        content = await file.text();
        size = file.size;
      }

      previewFileFromTree.set({
        id: node.path,
        name: node.name,
        size,
        type: "text",
        content,
      });
    } catch (error) {
      console.error("Ошибка чтения файла:", error);
    }
  }

    function handleInsertLink(e: Event) {
    e.stopPropagation();
    if (!editor || node.type !== "file") return;
    const linkText = `[${node.path}]`;
    editor.chain().focus().insertContent(linkText + " ").run();
  }

  function toggle() {
    if (node.type === "directory") isOpen = !isOpen;
  }
</script>

<div class="select-none">
  <div class="flex items-center gap-1.5 py-1 px-2 rounded-md hover:bg-surface-tertiary cursor-pointer transition-colors group" style="padding-left: {depth * 16 + 8}px" onclick={toggle}>
    <input type="checkbox" checked={isSelected} indeterminate={isPartial} onclick={toggleSelect} class="w-3.5 h-3.5 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer shrink-0 accent-brand-500" />

    {#if node.type === "directory"}
      {#if isOpen}<ChevronDown size={14} class="text-ink-tertiary shrink-0" />
      {:else}<ChevronRight size={14} class="text-ink-tertiary shrink-0" />{/if}
    {:else}
      <span class="w-3.5 shrink-0"></span>
    {/if}

    {#if node.type === "directory"}
      <Folder size={16} class="text-brand-500 shrink-0" />
    {:else}
      <FileText size={16} class="text-ink-tertiary shrink-0 group-hover:text-ink transition-colors" />
    {/if}

    <span class="text-sm text-ink truncate font-mono flex-1">{node.name}</span>

        {#if node.type === "file"}
      <button onclick={handleInsertLink} class="p-1 rounded hover:bg-surface-secondary opacity-0 group-hover:opacity-100 transition-opacity" title="Вставить ссылку на файл">
        <Link size={14} class="text-ink-secondary hover:text-brand-600" />
      </button>
      <button onclick={handlePreview} class="p-1 rounded hover:bg-surface-secondary opacity-0 group-hover:opacity-100 transition-opacity" title="Просмотреть содержимое">
        <Eye size={14} class="text-ink-secondary hover:text-ink" />
      </button>
    {/if}
  </div>

  {#if node.type === "directory" && isOpen && node.children.length > 0}
    <div class="border-l border-slate-200 ml-4">
      {#each node.children as child}
        <TreeNodeItem node={child} depth={depth + 1} {editor} />
      {/each}
    </div>
  {/if}
</div>