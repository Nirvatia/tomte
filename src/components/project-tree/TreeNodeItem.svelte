<script lang="ts">
  import { logError } from "$lib/log";
  import { t } from "$lib/i18n";
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
    /** Раскрыть папку независимо от того, что выбрал пользователь (при поиске). */
    forceOpen?: boolean;
    /** Пути, отсеянные фильтром (10.6): видны, но не выбираются. */
    filteredPaths?: ReadonlySet<string> | null;
  }

  let {
    node,
    depth = 0,
    editor = null,
    forceOpen = false,
    filteredPaths = null,
  }: Props = $props();

  // Читается только для папок (все проверки идут через node.type), поэтому просто true:
  // папки по умолчанию раскрыты.
  let userOpen = $state(true);
  const isOpen = $derived(forceOpen || userOpen);
  let isPreviewLoading = $state(false);

  function getAllFilePaths(n: TreeNode): string[] {
    if (n.type === "file") return [n.path];
    return n.children.flatMap(getAllFilePaths);
  }

  const filePaths = $derived(
    node.type === "file" ? [node.path] : getAllFilePaths(node),
  );

  // Отсеянные фильтром файлы не участвуют в выборе папки, но остаются видны.
  const selectablePaths = $derived(
    filteredPaths
      ? filePaths.filter((path) => !filteredPaths.has(path))
      : filePaths,
  );

  const isFilteredFile = $derived(
    node.type === "file" && (filteredPaths?.has(node.path) ?? false),
  );

  const isSelectable = $derived(selectablePaths.length > 0);

  const isSelected = $derived(
    node.type === "file"
      ? !isFilteredFile && $selectedProjectFiles.includes(node.path)
      : isSelectable &&
          selectablePaths.every((path) => $selectedProjectFiles.includes(path)),
  );

  const isPartial = $derived(
    node.type === "directory" &&
      isSelectable &&
      !isSelected &&
      selectablePaths.some((path) => $selectedProjectFiles.includes(path)),
  );

  function toggleSelect(event: Event) {
    event.stopPropagation();
    if (!isSelectable) return;
    if (isSelected) {
      selectedProjectFiles.update((current) =>
        current.filter((path) => !selectablePaths.includes(path)),
      );
    } else {
      selectedProjectFiles.update((current) => {
        const set = new Set(current);
        for (const path of selectablePaths) {
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
      logError("File read failed", error);
      await requestAlert({
        title: $t("tree.readError.title"),
        message: $t("tree.readError.message", {
          name: node.name,
          reason:
            error instanceof Error ? error.message : $t("common.unknownError"),
        }),
        confirmText: $t("common.ok"),
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
      userOpen = !userOpen;
    }
  }
</script>

<div
  class="group flex items-center gap-2 border-l-2 border-transparent py-[5px] pr-4 pl-[28px] text-ui text-[var(--text-secondary)] transition-all hover:bg-[var(--bg-light)] hover:text-[var(--text-primary)] {isSelected
    ? 'border-l-[var(--accent)] bg-[var(--accent-dim)] font-medium text-[var(--accent)]'
    : ''} {isFilteredFile ? 'opacity-45' : ''}"
  style="padding-left: {depth * 16 + 28}px"
>
  <Checkbox
    checked={isSelected}
    indeterminate={isPartial}
    onToggle={toggleSelect}
    disabled={!isSelectable || isFilteredFile}
    ariaLabel={$t("tree.selectNode", { name: node.name })}
  />

  <button
    type="button"
    onclick={toggle}
    class="icon-btn"
    aria-expanded={node.type === "directory" ? isOpen : undefined}
    aria-label={node.type === "directory"
      ? isOpen
        ? $t("tree.collapse")
        : $t("tree.expand")
      : $t("tree.file")}
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
      class="icon-btn opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 hover:text-[var(--accent)]"
      title={$t("tree.insertRef")}
      aria-label={$t("tree.insertRefTo", { name: node.name })}
    >
      <Link size={14} />
    </button>

    <button
      type="button"
      onclick={handlePreview}
      disabled={isPreviewLoading}
      class="icon-btn opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 disabled:pointer-events-none disabled:opacity-40"
      title={$t("tree.viewContent")}
      aria-label={$t("tree.viewContentOf", { name: node.name })}
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
      <TreeNodeItem
        node={child}
        depth={depth + 1}
        {editor}
        {forceOpen}
        {filteredPaths}
      />
    {/each}
  </div>
{/if}
