<script lang="ts">
  import { onMount } from "svelte";
  import { attachedFiles, fileName, exportFormat, editorHtml } from "../../stores";
  import { Upload, Save, CheckCircle } from "@lucide/svelte";
  import TiptapEditor from "./TiptapEditor.svelte";
  import AttachmentsPanel from "../attachments/AttachmentPanel.svelte";
  import PreviewModal from "../preview/PreviewModal.svelte";
  import TagPanel from "../tags/TagPanel.svelte";
  import ProjectTreeSidebar from "../project-tree/ProjectTreeSidebar.svelte";
  import type { Editor } from "@tiptap/core";
  import type { AttachedFile } from "../../types";
  import { getPlaceholder } from "../../utils/files";
  import { saveDraft, loadDraft } from "../../utils/draft";
  import { debounce } from "../../utils";

  let { onEditorReady = (editor: Editor) => {} }: { onEditorReady?: (editor: Editor) => void } = $props();

  let charCount = $state(0);
  let currentHtml = $state("");
  let dropZoneActive = $state(false);
  let editorInstance: Editor | null = $state(null);
  let saveStatus = $state<"idle" | "saving" | "saved">("idle");

  const debouncedSaveDraft = debounce(() => {
    saveStatus = "saving";
    saveDraft({
      editorHtml: currentHtml,
      attachedFiles: $attachedFiles,
      fileName: $fileName,
      exportFormat: $exportFormat,
    });
    setTimeout(() => {
      saveStatus = "saved";
      setTimeout(() => {
        saveStatus = "idle";
      }, 2000);
    }, 300);
  }, 500);

  $effect(() => {
    if (currentHtml || $attachedFiles.length > 0) {
      debouncedSaveDraft();
    }
  });

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
      saveStatus = "saved";
      setTimeout(() => {
        saveStatus = "idle";
      }, 3000);
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
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
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
    editorInstance.chain().focus().insertContent(placeholder + " ").run();
  }

  async function handlePaste(e: ClipboardEvent) {
    const items = e.clipboardData?.items;
    if (!items) return;

    const imageFiles: File[] = [];
    
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.indexOf('image') !== -1) {
        const file = item.getAsFile();
        if (file) {
          imageFiles.push(file);
        }
      }
    }

    if (imageFiles.length > 0) {
      e.preventDefault();
      
      for (const file of imageFiles) {
        try {
          const { processFile } = await import('../../utils/files');
          const attachedFile = await processFile(file);
          attachedFiles.update(($files) => [...$files, attachedFile]);
        } catch (error) {
          console.error('Error processing pasted image:', error);
        }
      }
    }
  }

  function insertContent(file: AttachedFile) {
    if (!editorInstance || file.type !== "text" || !file.content) return;
    const separator = "═".repeat(40);
    const content = `\n${separator}\n FILE: ${file.name}\n${separator}\n${file.content}\n${separator}\n`;
    editorInstance.chain().focus().insertContent(content).run();
  }
</script>

<svelte:window onpaste={handlePaste} />

<div class="h-full grid grid-cols-[auto_1fr_auto] gap-0">
  <ProjectTreeSidebar editor={editorInstance} />

  <div class="flex flex-col min-w-0 overflow-hidden p-6">
    <!-- Белый блок с фиксированной высотой и overflow-hidden -->
    <div
      class="flex-1 bg-surface rounded-2xl shadow-xl border border-slate-100 relative transition-all duration-300 overflow-hidden {dropZoneActive
        ? 'ring-4 ring-brand-500/30 border-brand-500'
        : ''}"
      role="region"
      aria-label="Область редактора"
      ondrop={handleDrop}
      ondragover={handleDragOver}
      ondragleave={handleDragLeave}
    >
      <!-- Скроллящийся контейнер внутри белого блока -->
      <div class="h-full overflow-y-auto p-12">
        <TiptapEditor content={currentHtml} onReady={handleReady} onUpdate={handleUpdate} />
      </div>

      {#if dropZoneActive}
        <div class="absolute inset-0 bg-brand-50/80 backdrop-blur-sm rounded-2xl flex items-center justify-center pointer-events-none animate-fade-in">
          <div class="text-center">
            <Upload size={48} class="mx-auto text-brand-500 mb-3" />
            <p class="text-xl font-semibold text-brand-700">Отпустите файлы для загрузки</p>
          </div>
        </div>
      {/if}
    </div>

    <!-- Статус и TagPanel вне скроллящегося контейнера -->
    <div class="mt-3 flex items-center justify-between text-sm text-ink-tertiary font-medium shrink-0">
      <span class="flex items-center gap-1.5">
        {#if saveStatus === "saving"}
          <Save size={14} class="text-amber-500 animate-pulse" />
          <span class="text-amber-600">Сохранение...</span>
        {:else if saveStatus === "saved"}
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