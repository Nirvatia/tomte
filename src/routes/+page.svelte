<script lang="ts">
  import AppHeader from '../components/header/AppHeader.svelte';
  import EditorToolbar from '../components/toolbar/EditorToolbar.svelte';
  import PromptEditor from '../components/editor/PromptEditor.svelte';
  import FileManagerModal from '../components/attachments/FileManagerModal.svelte';
  import ExtractorModal from '../components/extractor/ExtractorModal.svelte';
  import type { Editor } from '@tiptap/core';

  let editor = $state<Editor | null>(null);

  function handleEditorReady(e: Editor) {
    editor = e;
  }
</script>

<div class="min-h-screen bg-surface-tertiary flex flex-col">
  <AppHeader />

  <main class="flex-1 flex flex-col overflow-hidden">
    <EditorToolbar {editor} />

    <div class="flex-1 overflow-y-auto py-8 px-4 bg-surface-tertiary">
      <div class="max-w-7xl mx-auto h-full">
        <PromptEditor onEditorReady={handleEditorReady} />
      </div>
    </div>
  </main>

  <FileManagerModal />
  <ExtractorModal />
</div>
