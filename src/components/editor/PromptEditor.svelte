<script lang="ts">
  import { onMount } from 'svelte';
  import { attachedFiles, fileName, exportFormat, editorHtml } from '../../stores';
  import { Upload, Save, CheckCircle } from '@lucide/svelte';
  import TiptapEditor from './TiptapEditor.svelte';
  import AttachmentsPanel from '../attachments/AttachmentPanel.svelte';
  import PreviewModal from '../preview/PreviewModal.svelte';
  import TagPanel from '../tags/TagPanel.svelte';
  import type { Editor } from '@tiptap/core';
  import type { AttachedFile } from '../../types';
  import { getPlaceholder } from '../../utils/files';
  import { saveDraft, loadDraft } from '../../utils/draft';
  import { debounce } from '../../utils';

  let {
    onEditorReady = (editor: Editor) => {},
  }: { onEditorReady?: (editor: Editor) => void } = $props();

  let charCount = $state(0);
  let currentHtml = $state('');
  let dropZoneActive = $state(false);
  let editorInstance: Editor | null = $state(null);
  let saveStatus = $state<'idle' | 'saving' | 'saved'>('idle');

  const debouncedSaveDraft = debounce(() => {
    saveStatus = 'saving';
    saveDraft({
      editorHtml: currentHtml,
      attachedFiles: $attachedFiles,
      fileName: $fileName,
      exportFormat: $exportFormat,
    });
    setTimeout(() => {
      saveStatus = 'saved';
      setTimeout(() => {
        saveStatus = 'idle';
      }, 2000);
    }, 300);
  }, 500);

  $effect(() => {
    if (currentHtml || $attachedFiles.length > 0) {
      debouncedSaveDraft();
    }
  });

  // Синхронизируем html в стор
  $effect(() => {
    editorHtml.set(currentHtml);
  });

  onMount(() => {
    const draft = loadDraft();
    if (draft) {
      currentHtml = draft.editorHtml;
      attachedFiles.set(draft.attachedFiles);
      fileName.set(draft.fileName);
      exportFormat.set(draft.exportFormat);
      saveStatus = 'saved';
      setTimeout(() => { saveStatus = 'idle'; }, 3000);
    }

    const handleBeforeUnload = () => {
      if (currentHtml || $attachedFiles.length > 0) {
        saveDraft({
          editorHtml: currentHtml,
          attachedFiles: $attachedFiles,
          fileName: $fileName,
          exportFormat: $exportFormat,
        });
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  });

  function handleUpdate(data: { html: string; text: string; charCount: number }) {
    currentHtml = data.html;
    charCount = data.charCount;
  }

  function handleReady(editor: Editor) {
    editorInstance = editor;
    onEditorReady(editor);
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    dropZoneActive = false;
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    dropZoneActive = true;
  }

  function handleDragLeave() {
    dropZoneActive = false;
  }

  function insertPlaceholder(file: AttachedFile) {
    if (!editorInstance) return;
    const placeholder = getPlaceholder(file, $attachedFiles);
    editorInstance.chain().focus().insertContent(placeholder + ' ').run();
  }

  function insertContent(file: AttachedFile) {
    if (!editorInstance || file.type !== 'text' || !file.content) return;
    const separator = '═'.repeat(40);
    const content = `\n${separator}\n FILE: ${file.name}\n${separator}\n${file.content}\n${separator}\n`;
    editorInstance.chain().focus().insertContent(content).run();
  }
</script>

<div class="flex gap-6 min-h-full pb-12">
  <div class="flex-1 flex flex-col">
    <div
      class="flex-1 bg-surface rounded-2xl shadow-xl border border-slate-100 p-12 min-h-250 relative transition-all duration-300 {dropZoneActive
        ? 'ring-4 ring-brand-500/30 border-brand-500'
        : ''}"
      role="region"
      aria-label="Область редактора"
      ondrop={handleDrop}
      ondragover={handleDragOver}
      ondragleave={handleDragLeave}
    >
      <TiptapEditor
        content={currentHtml}
        onReady={handleReady}
        onUpdate={handleUpdate}
      />

      {#if dropZoneActive}
        <div class="absolute inset-0 bg-brand-50/80 backdrop-blur-sm rounded-2xl flex items-center justify-center pointer-events-none animate-fade-in">
          <div class="text-center">
            <Upload size={48} class="mx-auto text-brand-500 mb-3" />
            <p class="text-xl font-semibold text-brand-700">Отпустите файлы для загрузки</p>
          </div>
        </div>
      {/if}
    </div>

    <div class="mt-3 flex items-center justify-between text-sm text-ink-tertiary font-medium">
      <span class="flex items-center gap-1.5">
        {#if saveStatus === 'saving'}
          <Save size={14} class="text-amber-500 animate-pulse" />
          <span class="text-amber-600">Сохранение...</span>
        {:else if saveStatus === 'saved'}
          <CheckCircle size={14} class="text-emerald-500" />
          <span class="text-emerald-600">Сохранено</span>
        {:else}
          <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>Автосохранение включено</span>
        {/if}
      </span>
      <span>{charCount} символов</span>
    </div>

    <TagPanel editor={editorInstance} />
  </div>

  <AttachmentsPanel
    editor={editorInstance}
    onInsertPlaceholder={insertPlaceholder}
    onInsertContent={insertContent}
  />
</div>

<PreviewModal editorHtml={currentHtml} />