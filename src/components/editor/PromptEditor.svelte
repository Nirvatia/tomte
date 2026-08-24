<script lang="ts">
  import { onDestroy } from "svelte";
  import { get } from "svelte/store";
  import type { Editor } from "@tiptap/core";
  import { CircleCheck, FileText, Save, Upload } from "@lucide/svelte";

  import TiptapEditor from "./TiptapEditor.svelte";
  import PreviewModal from "../preview/PreviewModal.svelte";
  import TagPanel from "../tags/TagPanel.svelte";

  import { dropzone } from "$lib/actions/dropzone";

  import {
    activeFile,
    activeFileId,
    activeProject,
    editorHtml,
    pendingSaveController,
    projectSaveError,
  } from "../../stores";

  import { createFlushableAsync } from "../../utils";
  import { processFile } from "../../utils/files";
  import { saveProject } from "../../utils/projectDb";
  import { addAttachmentsToProject } from "../../utils/projectActions";

  interface Props {
    onEditorReady?: (editor: Editor) => void;
  }

  let { onEditorReady = () => {} }: Props = $props();

  let charCount = $state(0);
  let currentHtml = $state("");
  let dropZoneActive = $state(false);
  let editorInstance: Editor | null = $state(null);
  let saveStatus = $state<"idle" | "saving" | "saved" | "error">("idle");
  let saveStatusTimer: ReturnType<typeof setTimeout> | null = null;

  let loadedFileId: string | null = $state(null);
  let pendingSave: { fileId: string; content: string } | null = $state(null);

  $effect(() => {
    const file = $activeFile;
    if (file && file.id !== loadedFileId) {
      if (pendingSave && pendingSave.fileId !== file.id) {
        void debouncedSaveToProject.flush();
      }
      currentHtml = file.content;
      loadedFileId = file.id;
      charCount = 0;
    } else if (!file && loadedFileId !== null) {
      if (pendingSave) {
        void debouncedSaveToProject.flush();
      }
      currentHtml = "";
      loadedFileId = null;
      charCount = 0;
    }
  });

  function markSaved() {
    if (saveStatusTimer) {
      clearTimeout(saveStatusTimer);
    }
    saveStatus = "saved";
    saveStatusTimer = setTimeout(() => {
      saveStatus = "idle";
    }, 2000);
  }

  async function savePendingNow() {
    const project = get(activeProject);
    const saveData = pendingSave;
    if (!saveData || !project) return;

    pendingSave = null;

    const updatedFiles = project.files.map((f) =>
      f.id === saveData.fileId
        ? {
            ...f,
            content: saveData.content,
            updatedAt: new Date().toISOString(),
          }
        : f,
    );

    const updatedProject = {
      ...project,
      files: updatedFiles,
      updatedAt: new Date().toISOString(),
    };

    activeProject.set(updatedProject);

    try {
      saveStatus = "saving";
      await saveProject(updatedProject);
      markSaved();
    } catch (error) {
      console.error("Failed to save project:", error);
      saveStatus = "error";
      projectSaveError.set(
        error instanceof Error ? error.message : "Не удалось сохранить проект",
      );
    }
  }

  const debouncedSaveToProject = createFlushableAsync(savePendingNow, 800);

  $effect(() => {
    pendingSaveController.set({
      flush: () => debouncedSaveToProject.flush(),
    });
    return () => {
      pendingSaveController.set(null);
    };
  });

  onDestroy(() => {
    if (saveStatusTimer) {
      clearTimeout(saveStatusTimer);
    }
    void debouncedSaveToProject.flush();
  });

  function handleBeforeUnload() {
    void debouncedSaveToProject.flush();
  }

  $effect(() => {
    editorHtml.set(currentHtml);
  });

  function handleUpdate(data: {
    html: string;
    text: string;
    charCount: number;
  }) {
    currentHtml = data.html;
    charCount = data.charCount;

    const fileId = $activeFileId;
    if (!fileId) return;

    if ($activeFile && data.html === $activeFile.content) {
      return;
    }

    if (pendingSave && pendingSave.fileId !== fileId) {
      void debouncedSaveToProject.flush();
    }

    pendingSave = { fileId, content: data.html };
    debouncedSaveToProject();
  }

  function handleReady(editor: Editor) {
    editorInstance = editor;
    onEditorReady(editor);
  }

  async function handleFilesDropped(files: File[]) {
    dropZoneActive = false;
    for (const file of files) {
      try {
        const attachedFile = await processFile(file);
        await addAttachmentsToProject([attachedFile]);
      } catch (error) {
        console.error("Error processing dropped file:", error);
      }
    }
  }

  async function handlePaste(event: ClipboardEvent) {
    const items = event.clipboardData?.items;
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
      event.preventDefault();
      for (const file of imageFiles) {
        try {
          const attachedFile = await processFile(file);
          await addAttachmentsToProject([attachedFile]);
        } catch (error) {
          console.error("Error processing pasted image:", error);
        }
      }
    }
  }
</script>

<svelte:window onpaste={handlePaste} onbeforeunload={handleBeforeUnload} />

{#if $activeFile}
  <div class="editor-canvas flex h-full flex-col overflow-hidden p-5">
    <div
      use:dropzone={handleFilesDropped}
      class="relative flex-1 overflow-hidden bg-[var(--bg-darkest)] transition-all duration-300 {dropZoneActive
        ? 'ring-2 ring-inset ring-[var(--warning)]'
        : ''}"
      role="region"
      aria-label="Область редактора"
    >
      <div class="h-full overflow-y-auto p-8 lg:px-12 lg:py-8">
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
            <Upload size={44} class="mx-auto mb-3 text-[var(--warning)]" />
            <p class="text-lg font-semibold text-[var(--text-primary)]">
              Отпустите файлы для загрузки
            </p>
          </div>
        </div>
      {/if}
    </div>

    <div
      class="mt-3 flex shrink-0 items-center justify-between font-mono text-xs text-[var(--text-tertiary)]"
    >
      <span class="flex items-center gap-1.5">
        {#if saveStatus === "saving"}
          <Save size={13} class="animate-pulse text-[var(--warning)]" />
          <span class="text-[var(--accent-hover)]">Сохранение...</span>
        {:else if saveStatus === "saved"}
          <CircleCheck size={13} class="text-[var(--success)]" />
          <span class="text-[var(--success)]">Сохранено</span>
        {:else}
          <span
            class="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--success)] shadow-[0_0_7px_rgba(52,211,153,0.8)]"
          ></span>
          <span>Автосохранение включено</span>
        {/if}
      </span>
      <span class="flex items-center gap-3">
        <span class="text-[var(--text-dim)]">{$activeFile.name}</span>
        <span>{charCount} символов</span>
      </span>
    </div>

    <TagPanel editor={editorInstance} />
  </div>
{:else}
  <div class="flex h-full items-center justify-center bg-[var(--bg-darkest)]">
    <div class="text-center">
      <FileText size={48} class="mx-auto mb-4 text-[var(--text-dim)]" />
      <p class="text-sm font-medium text-[var(--text-secondary)]">
        Нет открытых файлов
      </p>
      <p class="mt-1.5 max-w-64 text-xs text-[var(--text-tertiary)]">
        Выберите файл в панели проекта или создайте новый через кнопку «+» на
        табах
      </p>
    </div>
  </div>
{/if}

<PreviewModal editorHtml={currentHtml} />
