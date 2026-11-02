<script lang="ts">
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
  import type { AttachedFile } from "../types";
  import { attachedFiles, isCodeMapOpen } from "../stores";
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
    <ProjectTreeSidebar {editor} onInsertPlaceholder={insertPlaceholder} />
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
  <GlobalHotkeys />
  <ContextMenuHost />
{:else}
  <div
    class="flex flex-1 items-center justify-center text-sm text-[var(--text-tertiary)]"
    role="status"
  >
    Загрузка проекта…
  </div>
{/if}
