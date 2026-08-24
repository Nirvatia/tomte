<script lang="ts">
  import {
    ChevronDown,
    ChevronRight,
    Eye,
    FileText,
    Folder,
    Link,
    LoaderCircle,
  } from "@lucide/svelte";

  import type { Editor } from "@tiptap/core";
  import type { TreeNode } from "../../utils/projectTree";

  import Checkbox from "../ui/Checkbox.svelte";
  import TreeNodeItem from "./TreeNodeItem.svelte";

  import { previewFileFromTree, selectedProjectFiles } from "../../stores";
  import { requestAlert } from "../../stores/confirm";

  import { fetchGithubFileContent } from "../../utils/github";

  interface Props {
    node: TreeNode;
    depth?: number;
    editor?: Editor | null;
  }

  let { node, depth = 0, editor = null }: Props = $props();

  let isOpen = $state(node.type === "directory");
  let isPreviewLoading = $state(false);

  function getAllFilePaths(n: TreeNode): string[] {
    if (n.type === "file") return [n.path];
    return n.children.flatMap(getAllFilePaths);
  }

  const filePaths = $derived(
    node.type === "file" ? [node.path] : getAllFilePaths(node),
  );

  const isSelected = $derived(
    node.type === "file"
      ? $selectedProjectFiles.includes(node.path)
      : filePaths.length > 0 &&
          filePaths.every((path) => $selectedProjectFiles.includes(path)),
  );

  const isPartial = $derived(
    node.type === "directory" &&
      !isSelected &&
      filePaths.some((path) => $selectedProjectFiles.includes(path)),
  );

  function toggleSelect(event: Event) {
    event.stopPropagation();
    if (isSelected) {
      selectedProjectFiles.update((current) =>
        current.filter((path) => !filePaths.includes(path)),
      );
    } else {
      selectedProjectFiles.update((current) => {
        const set = new Set(current);
        for (const path of filePaths) {
          set.add(path);
        }
        return Array.from(set);
      });
    }
  }

  async function handlePreview(event: Event) {
    event.stopPropagation();
    if (node.type !== "file") return;

    if (!node.fileRef && !node.githubRef) {
      previewFileFromTree.set({
        id: node.path,
        name: node.name,
        size: 0,
        type: "text",
      });
      return;
    }

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
      await requestAlert({
        title: "Ошибка чтения файла",
        message: `Не удалось прочитать файл «${node.name}».\n\n${
          error instanceof Error ? error.message : "Неизвестная ошибка"
        }`,
        confirmText: "Понятно",
        danger: true,
      });
    } finally {
      isPreviewLoading = false;
    }
  }

  function handleInsertLink(event: Event) {
    event.stopPropagation();
    if (!editor || node.type !== "file") return;
    const linkText = `[${node.path}]`;
    editor
      .chain()
      .focus()
      .insertContent(linkText + " ")
      .run();
  }

  function toggle(event: Event) {
    event.stopPropagation();
    if (node.type === "directory") {
      isOpen = !isOpen;
    }
  }
</script>

<div
  class="group flex items-center gap-2 border-l-2 border-transparent py-[5px] pr-4 pl-[28px] text-[13px] text-[var(--text-secondary)] transition-all hover:bg-[var(--bg-light)] hover:text-[var(--text-primary)] {isSelected
    ? 'border-l-[var(--accent)] bg-[var(--accent-dim)] font-medium text-[var(--accent)]'
    : ''}"
  style="padding-left: {depth * 16 + 28}px"
>
  <Checkbox
    checked={isSelected}
    indeterminate={isPartial}
    onToggle={toggleSelect}
    ariaLabel="Выбрать {node.name}"
  />

  <button
    type="button"
    onclick={toggle}
    class="flex shrink-0 items-center justify-center rounded p-1 transition-colors hover:bg-[var(--bg-lighter)]"
    aria-expanded={node.type === "directory" ? isOpen : undefined}
    aria-label={node.type === "directory"
      ? isOpen
        ? "Свернуть папку"
        : "Развернуть папку"
      : "Файл"}
  >
    {#if node.type === "directory"}
      {#if isOpen}
        <ChevronDown size={14} class="text-[var(--text-tertiary)]" />
      {:else}
        <ChevronRight size={14} class="text-[var(--text-tertiary)]" />
      {/if}
    {:else}
      <span class="block w-3.5"></span>
    {/if}
  </button>

  <div class="flex h-4 w-4 shrink-0 items-center justify-center">
    {#if node.type === "directory"}
      <Folder
        size={16}
        class="text-[var(--text-tertiary)] transition-colors group-hover:text-[var(--accent-hover)]"
      />
    {:else}
      <FileText
        size={16}
        class="text-[var(--text-tertiary)] transition-colors group-hover:text-[var(--text-primary)]"
      />
    {/if}
  </div>

  <span class="flex-1 cursor-default truncate">{node.name}</span>

  {#if node.type === "file"}
    <button
      type="button"
      onclick={handleInsertLink}
      class="rounded p-1 text-[var(--text-secondary)] opacity-0 transition-all hover:bg-[var(--bg-lighter)] hover:text-[var(--accent)] group-hover:opacity-100"
      title="Вставить ссылку на файл"
      aria-label="Вставить ссылку на файл {node.name}"
    >
      <Link size={14} />
    </button>

    <button
      type="button"
      onclick={handlePreview}
      disabled={isPreviewLoading}
      class="rounded p-1 text-[var(--text-secondary)] opacity-0 transition-all hover:bg-[var(--bg-lighter)] hover:text-[var(--text-primary)] group-hover:opacity-100 disabled:pointer-events-none"
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
  <div class="ml-4 border-l border-[var(--border)]">
    {#each node.children as child (child.path)}
      <TreeNodeItem node={child} depth={depth + 1} {editor} />
    {/each}
  </div>
{/if}
