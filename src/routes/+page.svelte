<script lang="ts">
  import { t } from "$lib/i18n";
  import { onMount } from "svelte";
  import type { Editor } from "@tiptap/core";
  import AppHeader from "../components/header/AppHeader.svelte";
  import ActivityBar from "../components/layout/ActivityBar.svelte";
  import StatusBar from "../components/layout/StatusBar.svelte";
  import TabsBar from "../components/editor/TabsBar.svelte";
  import EditorToolbar from "../components/toolbar/EditorToolbar.svelte";
  import PromptEditor from "../components/editor/PromptEditor.svelte";
  import ProjectTreeSidebar from "../components/project-tree/ProjectTreeSidebar.svelte";
  import FileManagerModal from "../components/attachments/FileManagerModal.svelte";
  import ExtractorModal from "../components/extractor/ExtractorModal.svelte";
  import ProjectManagerModal from "../components/projects/ProjectManagerModal.svelte";
  import TagManagerModal from "../components/tags/TagManagerModal.svelte";
  import CodeMapModal from "../components/project-tree/CodeMapModal.svelte";
  import GlobalHotkeys from "../components/shortcuts/GlobalHotkeys.svelte";
  import ContextMenuHost from "../components/ui/ContextMenuHost.svelte";
  import QuickOpenModal from "../components/shortcuts/QuickOpenModal.svelte";
  import ShortcutsModal from "../components/shortcuts/ShortcutsModal.svelte";
  import HistoryModal from "../components/history/HistoryModal.svelte";
  import type { AttachedFile } from "../types";
  import {
    attachedFiles,
    historyFileId,
    isCodeMapOpen,
    isProjectTreeOpen,
  } from "../stores";
  import { isDesktop } from "$lib/media";
  import { getPlaceholder } from "../utils/files";
  import { initializeActiveProject } from "../utils/projectDb";
  import { applyProjectToStores } from "../utils/projectActions";
  import { getLastProjectId } from "../utils/lastProject";

  let editor = $state<Editor | null>(null);
  let isReady = $state(false);

  function handleEditorReady(newEditor: Editor) {
    editor = newEditor;
  }

  function insertPlaceholder(file: AttachedFile) {
    if (!editor) return;
    const placeholder = getPlaceholder(file, $attachedFiles);
    editor
      .chain()
      .focus()
      .insertContent(placeholder + " ")
      .run();
  }

  onMount(async () => {
    const project = await initializeActiveProject(getLastProjectId());
    applyProjectToStores(project);
    isReady = true;
  });
</script>

{#if isReady}
  <AppHeader />
  <div class="flex flex-1 overflow-hidden">
    <ActivityBar />
    {#if $isDesktop}
      <ProjectTreeSidebar {editor} onInsertPlaceholder={insertPlaceholder} />
    {:else if $isProjectTreeOpen}
      <!-- Планшет и телефон (этап 9): сайдбар выезжает поверх редактора. -->
      <div
        class="fixed inset-0 z-40 bg-black/50 animate-fade-in"
        onclick={() => isProjectTreeOpen.set(false)}
        role="presentation"
        aria-hidden="true"
      ></div>
      <div class="fixed inset-y-0 left-0 z-50 w-[85vw] max-w-88">
        <ProjectTreeSidebar
          {editor}
          onInsertPlaceholder={insertPlaceholder}
          overlay
          onClose={() => isProjectTreeOpen.set(false)}
        />
      </div>
    {/if}
    <div class="flex flex-1 flex-col overflow-hidden bg-[var(--bg-darkest)]">
      <TabsBar />
      <EditorToolbar {editor} />
      <main class="flex-1 overflow-hidden">
        <PromptEditor onEditorReady={handleEditorReady} />
      </main>
    </div>
  </div>
  <StatusBar />
  <FileManagerModal />
  <ExtractorModal />
  <ProjectManagerModal />
  <TagManagerModal {editor} />
  <CodeMapModal
    isOpen={$isCodeMapOpen}
    onClose={() => isCodeMapOpen.set(false)}
  />
  <QuickOpenModal />
  <ShortcutsModal />
  {#if $historyFileId}
    <HistoryModal />
  {/if}
  <GlobalHotkeys />
  <ContextMenuHost />
{:else}
  <div
    class="flex flex-1 items-center justify-center text-sm text-[var(--text-tertiary)]"
    role="status"
  >
    {$t("app.loading")}
  </div>
{/if}
