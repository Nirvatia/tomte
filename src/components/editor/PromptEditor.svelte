<!-- PromptEditor.svelte -->
<script lang="ts">
  import { onMount } from "svelte";
  import {
    attachedFiles,
    fileName,
    exportFormat,
    editorHtml,
    projectTreeNodes,
    projectTreeRootName,
    projectTreeString,
    selectedProjectFiles,
  } from "../../stores";
  import { Upload, Save, CircleCheck } from "@lucide/svelte";
  import { dropzone } from "$lib/actions/dropzone";
  import TiptapEditor from "./TiptapEditor.svelte";
  import AttachmentsPanel from "../attachments/AttachmentPanel.svelte";
  import PreviewModal from "../preview/PreviewModal.svelte";
  import TagPanel from "../tags/TagPanel.svelte";
  import ProjectTreeSidebar from "../project-tree/ProjectTreeSidebar.svelte";
  import type { Editor } from "@tiptap/core";
  import type { AttachedFile } from "../../types";
  import { getPlaceholder } from "../../utils/files";
  import {
    saveDraft,
    loadDraft,
    loadProjectSource,
    clearProjectSource,
  } from "../../utils/draft";
import { buildTreeString } from "../../utils/projectTree";
  import { debounce } from "../../utils";

  let {
    onEditorReady = (editor: Editor) => {},
  }: { onEditorReady?: (editor: Editor) => void } = $props();

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
      projectTreeRootName: $projectTreeRootName,
      selectedProjectFiles: $selectedProjectFiles,
    });
    setTimeout(() => {
      saveStatus = "saved";
      setTimeout(() => {
        saveStatus = "idle";
      }, 2000);
    }, 300);
  }, 500);

  $effect(() => {
    if (
      currentHtml ||
      $attachedFiles.length > 0 ||
      $projectTreeNodes.length > 0
    ) {
      debouncedSaveDraft();
    }
  });

  $effect(() => {
    editorHtml.set(currentHtml);
  });

(async () => {
  try {
    const saved = await loadProjectSource();
    if (!saved) return;

    projectTreeNodes.set(saved.nodes);
    projectTreeRootName.set(saved.rootName);
    projectTreeString.set(buildTreeString(saved.rootName, saved.nodes));
  } catch (e) {
    console.warn("Не удалось восстановить дерево проекта из IndexedDB:", e);
    await clearProjectSource();
  }
})();

  function handleUpdate(data: {
    html: string;
    text: string;
    charCount: number;
  }) {
    currentHtml = data.html;
    charCount = data.charCount;
  }

  function handleReady(editor: Editor) {
    editorInstance = editor;
    onEditorReady(editor);
  }

  function handleFilesDropped(files: File[]) {
    dropZoneActive = false;
  }

  function insertPlaceholder(file: AttachedFile) {
    if (!editorInstance) return;
    const placeholder = getPlaceholder(file, $attachedFiles);
    editorInstance
      .chain()
      .focus()
      .insertContent(placeholder + " ")
      .run();
  }

  async function handlePaste(e: ClipboardEvent) {
    const items = e.clipboardData?.items;
    if (!items) return;

    const imageFiles: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.indexOf("image") !== -1) {
        const file = item.getAsFile();
        if (file) imageFiles.push(file);
      }
    }

    if (imageFiles.length > 0) {
      e.preventDefault();
      for (const file of imageFiles) {
        try {
          const { processFile } = await import("../../utils/files");
          const attachedFile = await processFile(file);
          attachedFiles.update(($files) => [...$files, attachedFile]);
        } catch (error) {
          console.error("Error processing pasted image:", error);
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

<div class="grid h-full grid-cols-[auto_1fr_auto] gap-0">
  <ProjectTreeSidebar editor={editorInstance} />

  <!-- Центральная колонка: канвас + лист документа -->
  <div class="editor-canvas flex min-w-0 flex-col overflow-hidden p-5">
    <div
      use:dropzone={handleFilesDropped}
      class="relative flex-1 overflow-hidden rounded-xl border bg-panel shadow-deep transition-all duration-300 {dropZoneActive
        ? 'border-amb'
        : 'border-line'}"
      role="region"
      aria-label="Область редактора"
    >
      <div class="h-full overflow-y-auto p-8 lg:px-14 lg:py-12">
        <TiptapEditor
          content={currentHtml}
          onReady={handleReady}
          onUpdate={handleUpdate}
        />
      </div>

      {#if dropZoneActive}
        <div
          class="pointer-events-none absolute inset-0 flex animate-fade-in items-center justify-center bg-black/60 backdrop-blur-sm"
        >
          <div class="text-center">
            <Upload size={44} class="mx-auto mb-3 text-amb" />
            <p class="text-lg font-semibold text-txt">
              Отпустите файлы для загрузки
            </p>
          </div>
        </div>
      {/if}
    </div>

    <!-- Строка статуса -->
    <div
      class="mt-3 flex shrink-0 items-center justify-between font-mono text-xs text-txt3"
    >
      <span class="flex items-center gap-1.5">
        {#if saveStatus === "saving"}
          <Save size={13} class="animate-pulse text-amb" />
          <span class="text-amb2">Сохранение...</span>
        {:else if saveStatus === "saved"}
          <CircleCheck size={13} class="text-ok" />
          <span class="text-ok">Сохранено</span>
        {:else}
          <span
            class="h-1.5 w-1.5 animate-pulse rounded-full bg-ok shadow-[0_0_7px_rgba(67,209,124,0.8)]"
          ></span>
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
  />
</div>

<PreviewModal editorHtml={currentHtml} />