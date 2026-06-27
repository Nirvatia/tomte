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

<div class="h-screen flex flex-col overflow-hidden bg-surface-tertiary">
  <AppHeader />
  <EditorToolbar {editor} />
  
  <main class="flex-1 overflow-hidden">
    <PromptEditor onEditorReady={handleEditorReady} />
  </main>

  <FileManagerModal />
  <ExtractorModal />
</div>