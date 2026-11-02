<script lang="ts">
  import { t } from "$lib/i18n";
  import { onDestroy } from "svelte";
  import { get } from "svelte/store";
  import type { Editor } from "@tiptap/core";
  import {
    CircleCheck,
    FileText,
    Save,
    TriangleAlert,
    Upload,
  } from "@lucide/svelte";

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
  } from "../../stores";

  import { createFlushableAsync, getErrorMessage } from "../../utils";
  import { notifyError } from "$lib/notify";
  import type { Project } from "../../types";
  import { getPlaceholder, processFile } from "../../utils/files";
  import {
    estimatePromptFileSize,
    saveProject,
    SAVE_META,
  } from "../../utils/projectDb";
  import { addAttachmentsToProject } from "../../utils/projectActions";

  interface Props {
    onEditorReady?: (editor: Editor) => void;
  }

  let { onEditorReady = () => {} }: Props = $props();

  let charCount = $state(0);
  let currentHtml = $state("");
  let dropZoneActive = $state(false);
  let editorInstance: Editor | null = $state(null);
  /**
   * dirty — есть изменения, автосохранение через 800 мс; saving — пишем в базу;
   * saved — всё в базе; error — запись не удалась, данные пока только в памяти.
   */
  let saveStatus = $state<"saved" | "dirty" | "saving" | "error">("saved");
  let saveErrorMessage = $state("");

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
      // charCount обновит TiptapEditor через onContentLoaded после загрузки текста.
    } else if (!file && loadedFileId !== null) {
      if (pendingSave) {
        void debouncedSaveToProject.flush();
      }
      currentHtml = "";
      loadedFileId = null;
      charCount = 0;
    }
  });

  /** Пишет метаданные проекта (промпты) и обновляет статус. */
  async function persist(project: Project) {
    const wasError = saveStatus === "error";
    saveStatus = "saving";
    try {
      // Пишем только метаданные и промпты: вложения и дерево не трогаем.
      await saveProject(project, SAVE_META);
      // Если пока писали, текст снова поменялся, статус остаётся «не сохранено».
      saveStatus = pendingSave ? "dirty" : "saved";
    } catch (error) {
      console.error("Failed to save project:", error);
      saveStatus = "error";
      saveErrorMessage = getErrorMessage(error, $t("editor.saveFailed"));
      // Одно уведомление на серию ошибок, а не на каждое нажатие клавиши.
      if (!wasError) {
        notifyError(
          $t("editor.notSavedToast", { reason: saveErrorMessage }),
          retrySave,
        );
      }
    }
  }

  function retrySave() {
    const project = get(activeProject);
    if (project) void persist(project);
  }

  async function savePendingNow() {
    const project = get(activeProject);
    const saveData = pendingSave;
    if (!saveData || !project) return;

    pendingSave = null;

    const target = project.files.find((f) => f.id === saveData.fileId);
    if (!target) return;

    const now = new Date().toISOString();
    const updatedFile = {
      ...target,
      content: saveData.content,
      updatedAt: now,
    };
    const updatedProject = {
      ...project,
      files: project.files.map((f) => (f.id === target.id ? updatedFile : f)),
      updatedAt: now,
      // Пересчитываем размер по разнице, а не по всему проекту.
      totalSize:
        project.totalSize -
        estimatePromptFileSize(target) +
        estimatePromptFileSize(updatedFile),
    };

    activeProject.set(updatedProject);
    await persist(updatedProject);
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
    void debouncedSaveToProject.flush();
  });

  function handleBeforeUnload(event: BeforeUnloadEvent) {
    void debouncedSaveToProject.flush();
    // Дождаться асинхронной записи браузер не даст, поэтому предупреждаем.
    if (saveStatus !== "saved") {
      event.preventDefault();
    }
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
    if (saveStatus !== "error") saveStatus = "dirty";
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
        notifyError(
          $t("editor.dropFailed", {
            name: file.name,
            reason: getErrorMessage(error, $t("editor.addFailed")),
          }),
        );
      }
    }
  }

  /**
   * Вставленные картинки становятся вложениями, а на место курсора встаёт
   * плейсхолдер [IMAGE_n: имя], как при клике по вложению в панели.
   */
  async function handlePasteImages(files: File[]) {
    for (const file of files) {
      try {
        const attached = await processFile(file);
        await addAttachmentsToProject([attached]);
        const all = get(activeProject)?.attachments ?? [];
        const added = all.find((f) => f.id === attached.id);
        if (added && editorInstance) {
          editorInstance
            .chain()
            .focus()
            .insertContent(getPlaceholder(added, all) + " ")
            .run();
        }
      } catch (error) {
        console.error("Error processing pasted image:", error);
        notifyError(getErrorMessage(error, $t("editor.pasteFailed")));
      }
    }
  }
</script>

<svelte:window onbeforeunload={handleBeforeUnload} />

{#if $activeFile}
  <div class="editor-canvas flex h-full flex-col overflow-hidden p-3">
    <div
      use:dropzone={handleFilesDropped}
      class="relative flex-1 overflow-hidden bg-[var(--bg-darkest)] transition-all duration-300 {dropZoneActive
        ? 'ring-2 ring-inset ring-[var(--warning)]'
        : ''}"
      role="region"
      aria-label={$t("editor.region")}
    >
      <div class="h-full overflow-y-auto p-8 lg:px-12 lg:py-8">
        <TiptapEditor
          content={currentHtml}
          onReady={handleReady}
          onUpdate={handleUpdate}
          onContentLoaded={(count) => (charCount = count)}
          onPasteImages={handlePasteImages}
        />
      </div>

      {#if dropZoneActive}
        <div
          class="pointer-events-none absolute inset-0 flex animate-fade-in items-center justify-center bg-black/60 backdrop-blur-sm"
        >
          <div class="text-center">
            <Upload size={44} class="mx-auto mb-3 text-[var(--warning)]" />
            <p class="text-lg font-semibold text-[var(--text-primary)]">
              {$t("editor.dropHere")}
            </p>
          </div>
        </div>
      {/if}
    </div>

    <div
      class="mt-3 flex shrink-0 items-center justify-between font-mono text-xs text-[var(--text-tertiary)]"
    >
      <span
        class="flex items-center gap-1.5"
        role="status"
        aria-label={$t("editor.saveStatus")}
      >
        {#if saveStatus === "saving"}
          <Save size={13} class="animate-pulse text-[var(--warning)]" />
          <span class="text-[var(--accent-hover)]">{$t("editor.saving")}</span>
        {:else if saveStatus === "error"}
          <TriangleAlert size={13} class="text-[var(--error)]" />
          <span class="text-[var(--error)]" title={saveErrorMessage}>
            {$t("editor.notSaved", { reason: saveErrorMessage })}
          </span>
          <button
            type="button"
            onclick={retrySave}
            class="ml-1 rounded px-1.5 py-0.5 text-[var(--text-secondary)] underline hover:text-[var(--text-primary)]"
          >
            {$t("common.retry")}
          </button>
        {:else if saveStatus === "saved"}
          <CircleCheck size={13} class="text-[var(--success)]" />
          <span class="text-[var(--success)]">{$t("editor.saved")}</span>
        {:else}
          <span class="h-1.5 w-1.5 rounded-full bg-[var(--warning)]"></span>
          <span title={$t("editor.dirtyHint")}>{$t("editor.dirty")}</span>
        {/if}
      </span>
      <span class="flex items-center gap-3">
        <span class="text-[var(--text-tertiary)]">{$activeFile.name}</span>
        <span>{$t("common.chars", { count: charCount })}</span>
      </span>
    </div>

    <TagPanel editor={editorInstance} />
  </div>
{:else}
  <div class="flex h-full items-center justify-center bg-[var(--bg-darkest)]">
    <div class="text-center">
      <FileText size={48} class="mx-auto mb-4 text-[var(--text-dim)]" />
      <p class="text-sm font-medium text-[var(--text-secondary)]">
        {$t("editor.noFiles")}
      </p>
      <p class="mt-1.5 max-w-64 text-xs text-[var(--text-tertiary)]">
        {$t("editor.noFilesHint")}
      </p>
    </div>
  </div>
{/if}

<PreviewModal editorHtml={currentHtml} />
