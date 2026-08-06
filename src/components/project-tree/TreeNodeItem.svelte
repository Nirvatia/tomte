<!-- TreeNodeItem.svelte -->
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
  class="group flex items-center gap-1.5 rounded-md px-2 py-1 transition-colors hover:bg-raised"
  style="padding-left: {depth * 16 + 8}px"
>
  <input
    type="checkbox"
    checked={isSelected}
    indeterminate={isPartial}
    onclick={toggleSelect}
    class="h-3.5 w-3.5 shrink-0 cursor-pointer rounded-sm accent-amb"
    aria-label="Выбрать {node.name}"
  />

  <!-- Кнопка сворачивания/разворачивания -->
  <button
    type="button"
    onclick={toggle}
    class="flex shrink-0 items-center justify-center rounded p-1 transition-colors hover:bg-raised2"
    aria-expanded={node.type === "directory" ? isOpen : undefined}
    aria-label={node.type === "directory"
      ? isOpen
        ? "Свернуть папку"
        : "Развернуть папку"
      : "Файл"}
  >
    {#if node.type === "directory"}
      {#if isOpen}
        <ChevronDown size={14} class="text-txt3" />
      {:else}
        <ChevronRight size={14} class="text-txt3" />
      {/if}
    {:else}
      <span class="block w-3.5"></span>
    {/if}
  </button>

  {#if node.type === "directory"}
    <Folder
      size={16}
      class="shrink-0 text-txt3 transition-colors group-hover:text-amb2"
    />
  {:else}
    <FileText
      size={16}
      class="shrink-0 text-txt3 transition-colors group-hover:text-txt"
    />
  {/if}

  <span class="flex-1 cursor-default truncate font-mono text-sm text-txt"
    >{node.name}</span
  >

  {#if node.type === "file"}
    <button
      type="button"
      onclick={handleInsertLink}
      class="rounded p-1 text-txt2 opacity-0 transition-all hover:bg-raised2 hover:text-amb group-hover:opacity-100"
      title="Вставить ссылку на файл"
      aria-label="Вставить ссылку на файл {node.name}"
    >
      <Link size={14} />
    </button>
    <button
      type="button"
      onclick={handlePreview}
      disabled={isPreviewLoading}
      class="rounded p-1 text-txt2 opacity-0 transition-all hover:bg-raised2 hover:text-txt group-hover:opacity-100 disabled:pointer-events-none"
      title="Просмотреть содержимое"
      aria-label="Просмотреть содержимое {node.name}"
    >
      {#if isPreviewLoading}
        <LoaderCircle size={14} class="animate-spin" />
      {:else}
        <Eye size={14} />
      {/if}
    </button>
  {/if}
</div>

{#if node.type === "directory" && isOpen && node.children.length > 0}
  <div class="ml-4 border-l border-line">
    {#each node.children as child}
      <TreeNodeItem node={child} depth={depth + 1} {editor} />
    {/each}
  </div>
{/if}