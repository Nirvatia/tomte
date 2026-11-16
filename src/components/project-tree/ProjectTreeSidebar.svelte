<script lang="ts">
  import { t } from "$lib/i18n";
  import { browser } from "$app/environment";
  import { onMount } from "svelte";
  import { Plus, RefreshCw as RefreshIcon, X } from "@lucide/svelte";
  import type { Editor } from "@tiptap/core";
  import type { AttachedFile } from "../../types";
  import FilePreviewModal from "../attachments/FilePreviewModal.svelte";
  import AttachmentsSection from "./AttachmentsSection.svelte";
  import GithubConnectModal from "./GithubConnectModal.svelte";
  import ProjectTreeSection from "./ProjectTreeSection.svelte";
  import PromptsSection from "./PromptsSection.svelte";
  import {
    isProjectTreeOpen,
    previewFileFromTree,
    projectTreeNodes,
  } from "../../stores";
  import {
    createPromptFile,
    refreshProjectTree,
  } from "../../utils/projectActions";
  import { getTreeGithubConfig } from "../../utils/projectTree";
  import { requestAlert } from "../../stores/confirm";

  interface Props {
    editor?: Editor | null;
    onInsertPlaceholder?: (file: AttachedFile) => void;
    /** Этап 9: сайдбар поверх редактора (планшет/телефон). */
    overlay?: boolean;
    /** Закрыть оверлей (крестик, выбор файла, backdrop). */
    onClose?: () => void;
  }

  let {
    editor = null,
    onInsertPlaceholder = () => {},
    overlay = false,
    onClose = () => {},
  }: Props = $props();

  let isGithubModalOpen = $state(false);
  let treeStateInitialized = $state(false);
  let isCreatingPrompt = $state(false);
  let isRefreshing = $state(false);

  // Дерево из GitHub? Определяем по узлам, а не по конфигу проекта.
  const hasGithubTree = $derived(
    getTreeGithubConfig($projectTreeNodes) !== undefined,
  );

  const SIDEBAR_MIN = 320;
  const SIDEBAR_MAX = 600;
  const SIDEBAR_DEFAULT = 320;

  let sidebarWidth = $state(SIDEBAR_DEFAULT);
  let isResizing = $state(false);

  function handleResizeStart(event: MouseEvent) {
    event.preventDefault();
    isResizing = true;
    document.addEventListener("mousemove", handleResizeMove);
    document.addEventListener("mouseup", handleResizeEnd);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }

  function handleResizeMove(event: MouseEvent) {
    if (!isResizing) return;
    const newWidth = Math.min(
      SIDEBAR_MAX,
      Math.max(SIDEBAR_MIN, event.clientX),
    );
    sidebarWidth = newWidth;
  }

  function handleResizeEnd() {
    isResizing = false;
    document.removeEventListener("mousemove", handleResizeMove);
    document.removeEventListener("mouseup", handleResizeEnd);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    if (browser) {
      localStorage.setItem("projectTreeWidth", String(sidebarWidth));
    }
  }

  async function handleCreatePromptFile() {
    if (isCreatingPrompt) return;
    isCreatingPrompt = true;
    try {
      await createPromptFile();
    } catch (error) {
      console.error("Failed to create prompt file:", error);
    } finally {
      isCreatingPrompt = false;
    }
  }

  async function handleRefreshTree() {
    if (isRefreshing || !hasGithubTree) return;
    isRefreshing = true;
    try {
      await refreshProjectTree();
    } catch (error) {
      console.error("Failed to refresh project tree:", error);
      await requestAlert({
        title: $t("tree.refreshError"),
        message:
          error instanceof Error ? error.message : $t("common.unknownError"),
        confirmText: $t("common.ok"),
        danger: true,
      });
    } finally {
      isRefreshing = false;
    }
  }

  onMount(() => {
    if (!browser) return;
    // Оверлей монтируется уже после открытия: читать localStorage нельзя —
    // там лежит прошлое значение и он мгновенно закрыл бы панель.
    if (!overlay) {
      const saved = localStorage.getItem("projectTreeOpen");
      if (saved !== null) {
        isProjectTreeOpen.set(saved === "true");
      }
    }
    treeStateInitialized = true;

    if (overlay) return;
    const savedWidth = localStorage.getItem("projectTreeWidth");
    if (savedWidth) {
      const w = parseInt(savedWidth, 10);
      if (!isNaN(w) && w >= SIDEBAR_MIN && w <= SIDEBAR_MAX) {
        sidebarWidth = w;
      }
    }
  });

  $effect(() => {
    if (!browser || !treeStateInitialized) return;
    localStorage.setItem("projectTreeOpen", String($isProjectTreeOpen));
  });
</script>

<aside
  class="relative h-full shrink-0 overflow-hidden transition-[width] duration-200 ease-out {$isProjectTreeOpen
    ? ''
    : 'w-0'}"
  style={$isProjectTreeOpen && !overlay ? `width: ${sidebarWidth}px` : ""}
>
  <div
    class="flex h-full flex-col border-r border-[var(--border)] bg-[var(--bg-medium)]"
    style={overlay ? "" : `width: ${sidebarWidth}px`}
  >
    <div
      class="flex shrink-0 items-center justify-between border-b border-[var(--border)] px-4 py-3"
    >
      <span
        class="text-caption font-semibold uppercase tracking-[0.8px] text-[var(--text-tertiary)]"
      >
        {$t("sidebar.title")}
      </span>
      <div class="flex gap-3">
        {#if overlay}
          <button
            type="button"
            onclick={onClose}
            class="flex h-6 w-6 cursor-pointer items-center justify-center rounded text-[var(--text-tertiary)] transition-colors hover:bg-[var(--bg-light)] hover:text-[var(--text-primary)]"
            title={$t("common.close")}
            aria-label={$t("common.close")}
          >
            <X size={16} />
          </button>
        {/if}
        <button
          type="button"
          onclick={() => void handleCreatePromptFile()}
          disabled={isCreatingPrompt}
          data-tour="new-prompt"
          class="flex h-6 w-6 cursor-pointer items-center justify-center rounded text-[var(--text-tertiary)] transition-colors hover:bg-[var(--bg-light)] hover:text-[var(--text-primary)] disabled:pointer-events-none disabled:opacity-40"
          title={$t("tabs.newFile")}
          aria-label={$t("tabs.newFile")}
        >
          <Plus size={18} />
        </button>
        <button
          type="button"
          onclick={() => void handleRefreshTree()}
          disabled={isRefreshing || !hasGithubTree}
          class="flex h-6 w-6 cursor-pointer items-center justify-center rounded text-[var(--text-tertiary)] transition-colors hover:bg-[var(--bg-light)] hover:text-[var(--text-primary)] disabled:pointer-events-none disabled:opacity-40"
          title={hasGithubTree
            ? $t("tree.refresh")
            : $t("tree.refreshUnavailable")}
          aria-label={$t("tree.refreshLabel")}
        >
          <RefreshIcon size={18} class={isRefreshing ? "animate-spin" : ""} />
        </button>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto py-2">
      <PromptsSection onFileOpen={overlay ? onClose : undefined} />
      <AttachmentsSection {onInsertPlaceholder} />
      <ProjectTreeSection
        {editor}
        onOpenGithubModal={() => (isGithubModalOpen = true)}
      />
    </div>
  </div>

  {#if $isProjectTreeOpen && !overlay}
    <button
      type="button"
      class="absolute right-0 top-0 bottom-0 z-[var(--layer-raised)] w-[4px] cursor-col-resize bg-transparent transition-colors hover:bg-[var(--accent)]/30 active:bg-[var(--accent)]/50 focus:outline-none"
      onmousedown={handleResizeStart}
      aria-label={$t("sidebar.resize")}
    ></button>
  {/if}
</aside>

<FilePreviewModal
  file={$previewFileFromTree}
  onClose={() => previewFileFromTree.set(null)}
/>

<GithubConnectModal
  isOpen={isGithubModalOpen}
  onClose={() => (isGithubModalOpen = false)}
/>
