<script lang="ts">
  import {
    Folder,
    FileText,
    ChevronRight,
    ChevronDown,
    Eye,
    Link,
    LoaderCircle,
  } from "@lucide/svelte";
  import type { TreeNode } from "../../utils/projectTree";
  import type { Editor } from "@tiptap/core";
  import TreeNodeItem from "./TreeNodeItem.svelte";
  import { selectedProjectFiles, previewFileFromTree } from "../../stores";
  import { fetchGithubFileContent } from "../../utils/github";

  let {
    node,
    depth = 0,
    editor = null,
  }: { node: TreeNode; depth?: number; editor?: Editor | null } = $props();

  let isOpen = $state(false);
  let isPreviewLoading = $state(false);

  $effect(() => {
    isOpen = node.type === "directory";
  });

  function getAllFilePaths(n: TreeNode): string[] {
    if (n.type === "file") return [n.path];
    return n.children.flatMap(getAllFilePaths);
  }

  let isSelected = $derived(
    node.type === "file"
      ? $selectedProjectFiles.includes(node.path)
      : getAllFilePaths(node).every((p) => $selectedProjectFiles.includes(p)) &&
          getAllFilePaths(node).length > 0,
  );

  let isPartial = $derived(
    node.type === "directory" &&
      !isSelected &&
      getAllFilePaths(node).some((p) => $selectedProjectFiles.includes(p)),
  );

  function toggleSelect(e: Event) {
    e.stopPropagation();
    const paths = node.type === "file" ? [node.path] : getAllFilePaths(node);
    if (isSelected) {
      selectedProjectFiles.update((current) =>
        current.filter((p) => !paths.includes(p)),
      );
    } else {
      selectedProjectFiles.update((current) => {
        const set = new Set(current);
        for (const p of paths) set.add(p);
        return Array.from(set);
      });
    }
  }

  async function handlePreview(e: Event) {
    e.stopPropagation();
    if (node.type !== "file") return;

    isPreviewLoading = true;
    try {
      let content = "";
      let size = 0;

      if (node.fileRef) {
        if (node.fileRef instanceof File) {
          content = await node.fileRef.text();
          size = node.fileRef.size;
        } else {
          const file = await (node.fileRef as FileSystemFileHandle).getFile();
          content = await file.text();
          size = file.size;
        }
      } else if (node.githubRef) {
        const githubFile = await fetchGithubFileContent(node);
        content = githubFile.content;
        size = githubFile.size;
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
      alert(
        `Не удалось прочитать файл: ${error instanceof Error ? error.message : "Неизвестная ошибка"}`,
      );
    } finally {
      isPreviewLoading = false;
    }
  }

  function handleInsertLink(e: Event) {
    e.stopPropagation();
    if (!editor || node.type !== "file") return;
    const linkText = `[${node.path}]`;
    editor
      .chain()
      .focus()
      .insertContent(linkText + " ")
      .run();
  }

  function toggle(e: Event) {
    e.stopPropagation();
    if (node.type === "directory") {
      isOpen = !isOpen;
    }
  }
</script>

<div
  class="flex items-center gap-1.5 py-1 px-2 rounded-md hover:bg-surface-tertiary transition-colors group"
  style="padding-left: {depth * 16 + 8}px"
>
  <input
    type="checkbox"
    checked={isSelected}
    indeterminate={isPartial}
    onclick={toggleSelect}
    class="w-3.5 h-3.5 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer shrink-0 accent-brand-500"
    aria-label="Выбрать {node.name}"
  />

  <!-- Кнопка сворачивания/разворачивания -->
  <button
    type="button"
    onclick={toggle}
    class="p-1 rounded hover:bg-surface-tertiary transition-colors shrink-0 flex items-center justify-center"
    aria-expanded={node.type === "directory" ? isOpen : undefined}
    aria-label={node.type === "directory"
      ? isOpen
        ? "Свернуть папку"
        : "Развернуть папку"
      : "Файл"}
  >
    {#if node.type === "directory"}
      {#if isOpen}
        <ChevronDown size={14} class="text-ink-tertiary" />
      {:else}
        <ChevronRight size={14} class="text-ink-tertiary" />
      {/if}
    {:else}
      <span class="w-3.5 block"></span>
    {/if}
  </button>

  {#if node.type === "directory"}
    <Folder size={16} class="text-brand-500 shrink-0" />
  {:else}
    <FileText
      size={16}
      class="text-ink-tertiary shrink-0 group-hover:text-ink transition-colors"
    />
  {/if}

  <span class="text-sm text-ink truncate font-mono flex-1 cursor-default"
    >{node.name}</span
  >

  {#if node.type === "file"}
    <button
      type="button"
      onclick={handleInsertLink}
      class="p-1 rounded hover:bg-surface-secondary opacity-0 group-hover:opacity-100 transition-opacity"
      title="Вставить ссылку на файл"
      aria-label="Вставить ссылку на файл {node.name}"
    >
      <Link size={14} class="text-ink-secondary hover:text-brand-600" />
    </button>

    <button
      type="button"
      onclick={handlePreview}
      disabled={isPreviewLoading}
      class="p-1 rounded hover:bg-surface-secondary opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
      title="Просмотреть содержимое"
      aria-label="Просмотреть содержимое {node.name}"
    >
      {#if isPreviewLoading}
        <LoaderCircle size={14} class="animate-spin text-ink-secondary" />
      {:else}
        <Eye size={14} class="text-ink-secondary hover:text-ink" />
      {/if}
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
