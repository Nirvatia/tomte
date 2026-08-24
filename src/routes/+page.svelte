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

  import type { AttachedFile } from "../types";
  import { attachedFiles } from "../stores";
  import { getPlaceholder } from "../utils/files";
  import { initializeActiveProject } from "../utils/projectDb";
  import { applyProjectToStores } from "../utils/projectActions";

  let editor = $state<Editor | null>(null);

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
    const project = await initializeActiveProject();
    applyProjectToStores(project);
  });
</script>

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
