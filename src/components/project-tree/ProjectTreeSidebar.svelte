<script lang="ts">
  import { browser } from "$app/environment";
  import { onMount } from "svelte";

  import { Plus, RefreshCw as RefreshIcon } from "@lucide/svelte";

  import type { Editor } from "@tiptap/core";
  import type { AttachedFile } from "../../types";

  import FilePreviewModal from "../attachments/FilePreviewModal.svelte";
  import AttachmentsSection from "./AttachmentsSection.svelte";
  import GithubConnectModal from "./GithubConnectModal.svelte";
  import ProjectTreeSection from "./ProjectTreeSection.svelte";
  import PromptsSection from "./PromptsSection.svelte";

  import { isProjectTreeOpen, previewFileFromTree } from "../../stores";

  interface Props {
    editor?: Editor | null;
    onInsertPlaceholder?: (file: AttachedFile) => void;
  }

  let { editor = null, onInsertPlaceholder = () => {} }: Props = $props();

  let isGithubModalOpen = $state(false);
  let treeStateInitialized = $state(false);

  const SIDEBAR_MIN = 200;
  const SIDEBAR_MAX = 600;
  const SIDEBAR_DEFAULT = 280;

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

  function handleClose() {
    isProjectTreeOpen.set(false);
  }

  function handleKeydown(event: KeyboardEvent) {
    if (
      event.key === "Escape" &&
      !isGithubModalOpen &&
      !$previewFileFromTree &&
      $isProjectTreeOpen
    ) {
      handleClose();
    }
  }

  onMount(() => {
    if (!browser) return;
    const saved = localStorage.getItem("projectTreeOpen");
    if (saved !== null) {
      isProjectTreeOpen.set(saved === "true");
    }

    treeStateInitialized = true;
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

<svelte:window onkeydown={handleKeydown} />

<aside
  class="relative shrink-0 overflow-hidden transition-[width] duration-200 ease-out {$isProjectTreeOpen
    ? ''
    : 'w-0'}"
  style={$isProjectTreeOpen ? `width: ${sidebarWidth}px` : ""}
>
  <div
    class="flex h-full flex-col border-r border-[var(--border)] bg-[var(--bg-medium)]"
    style="width: {sidebarWidth}px"
  >
    <div
      class="flex shrink-0 items-center justify-between border-b border-[var(--border)] px-4 py-3"
    >
      <span
        class="text-[11px] font-semibold uppercase tracking-[0.8px] text-[var(--text-tertiary)]"
      >
        Explorer
      </span>
      <div class="flex gap-1">
        <button
          type="button"
          onclick={() => {}}
          class="flex h-6 w-6 cursor-pointer items-center justify-center rounded text-[var(--text-tertiary)] transition-colors hover:bg-[var(--bg-light)] hover:text-[var(--text-primary)]"
          title="New Prompt File"
          aria-label="Создать новый файл промпта"
        >
          <Plus size={15} />
        </button>
        <button
          type="button"
          onclick={() => {}}
          class="flex h-6 w-6 cursor-pointer items-center justify-center rounded text-[var(--text-tertiary)] transition-colors hover:bg-[var(--bg-light)] hover:text-[var(--text-primary)]"
          title="Refresh"
          aria-label="Обновить"
        >
          <RefreshIcon size={15} />
        </button>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto py-2">
      <PromptsSection />
      <AttachmentsSection {onInsertPlaceholder} />
      <ProjectTreeSection
        {editor}
        onOpenGithubModal={() => (isGithubModalOpen = true)}
      />
    </div>
  </div>

  {#if $isProjectTreeOpen}
    <button
      type="button"
      class="absolute right-0 top-0 bottom-0 z-10 w-[4px] cursor-col-resize bg-transparent transition-colors hover:bg-[var(--accent)]/30 active:bg-[var(--accent)]/50 focus:outline-none"
      onmousedown={handleResizeStart}
      aria-label="Изменить ширину панели"
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
