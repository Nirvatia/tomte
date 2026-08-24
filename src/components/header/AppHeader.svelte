<script lang="ts">
  import {
    ChevronDown,
    CircleAlert,
    Download,
    ExternalLink,
    File as FileIcon,
    FileCode,
    FileText,
    Image,
    LoaderCircle,
  } from "@lucide/svelte";

  import Checkbox from "../ui/Checkbox.svelte";
  import AppLogo from "./AppLogo.svelte";

  import type { ExportFormat } from "../../types";
  import {
    activeFile,
    activeProject,
    attachedFiles,
    editorHtml,
    exportFormat,
    fileName,
    projectTreeNodes,
    selectedFileIds,
    selectedProjectFiles,
  } from "../../stores";

  import { exportFile } from "../../utils/export";
  import { getSelectedTreeFilesAsAttachments } from "../../utils/projectTree";

  let isExportMenuOpen = $state(false);
  let isExporting = $state(false);
  let exportError = $state<string | null>(null);
  let openInNewTab = $state(false);
  let exportMenuContainer = $state<HTMLDivElement | null>(null);

  function toggleExportMenu(event: MouseEvent) {
    event.stopPropagation();
    isExportMenuOpen = !isExportMenuOpen;
  }

  function handleClickOutside(event: MouseEvent) {
    if (
      isExportMenuOpen &&
      exportMenuContainer &&
      !exportMenuContainer.contains(event.target as Node)
    ) {
      isExportMenuOpen = false;
    }
  }

  function closeErrorModal() {
    exportError = null;
  }

  function handleModalBackdropKeydown(event: KeyboardEvent) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
    }
    if (event.key === "Escape") {
      closeErrorModal();
    }
  }

  async function handleExport(format: ExportFormat) {
    exportFormat.set(format);
    isExportMenuOpen = false;
    if (isExporting) return;

    isExporting = true;
    exportError = null;

    try {
      const selectedAttachments = $attachedFiles.filter((f) =>
        $selectedFileIds.has(f.id),
      );
      const rawTreeFiles = await getSelectedTreeFilesAsAttachments(
        $projectTreeNodes,
        $selectedProjectFiles,
      );
      const selectedTreeFiles = rawTreeFiles.map((f) => ({
        ...f,
        id: `tree_${f.id}`,
      }));
      const filesToExport = [...selectedAttachments, ...selectedTreeFiles];

      if (!$editorHtml.trim() && filesToExport.length === 0) {
        throw new Error(
          "Нечего экспортировать. Добавьте текст или выберите файлы.",
        );
      }

      const rawName = $activeFile?.name ?? $fileName;
      const exportName = rawName.replace(/\.[^/.]+$/, "");

      await exportFile(format, $editorHtml, filesToExport, exportName, {
        openInNewTab,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Неизвестная ошибка";
      if (
        errorMessage.includes("Слишком много") ||
        errorMessage.includes("Слишком большой")
      ) {
        console.warn("Превышен лимит экспорта:", errorMessage);
      } else {
        console.error("Ошибка экспорта:", error);
      }
      exportError = errorMessage;
    } finally {
      isExporting = false;
    }
  }

  const EXPORT_ITEM_BASE =
    "flex w-full items-center gap-2.5 rounded-[5px] px-3 py-2 text-left text-[13px] font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-lighter)] hover:text-[var(--text-primary)]";
</script>

<svelte:window onclick={handleClickOutside} />

<header
  class="flex h-[38px] shrink-0 items-center justify-between gap-4 border-b border-[var(--border)] bg-[var(--bg-dark)] px-4 text-[13px] text-[var(--text-secondary)]"
>
  <AppLogo size="compact" />

  <div bind:this={exportMenuContainer} class="relative">
    <button
      type="button"
      onclick={toggleExportMenu}
      disabled={isExporting}
      class="flex h-7 items-center gap-1.5 rounded-md bg-[var(--accent)] px-3 text-xs font-semibold text-[var(--bg-darkest)] transition-colors hover:bg-[var(--accent-hover)] disabled:pointer-events-none disabled:opacity-50"
      aria-haspopup="menu"
      aria-expanded={isExportMenuOpen}
      aria-label="Экспорт"
    >
      {#if isExporting}
        <LoaderCircle size={14} class="animate-spin" />
      {:else}
        <Download size={14} />
      {/if}
      <span>Экспорт</span>
      <ChevronDown
        size={12}
        class="transition-transform duration-150 {isExportMenuOpen
          ? 'rotate-180'
          : ''}"
      />
    </button>

    {#if isExportMenuOpen}
      <div
        role="menu"
        aria-label="Формат экспорта"
        class="absolute right-0 top-full z-50 mt-2 w-64 animate-fade-in rounded-[6px] border border-[var(--border-light)] bg-[var(--bg-medium)] p-1.5 shadow-[var(--shadow-md)]"
      >
        <button
          type="button"
          role="menuitem"
          onclick={() => handleExport("md")}
          class={EXPORT_ITEM_BASE}
        >
          <FileCode size={14} class="shrink-0" />
          <span class="flex-1">Markdown</span>
          {#if $exportFormat === "md"}
            <span class="h-1.5 w-1.5 rounded-full bg-[var(--accent)]"></span>
          {/if}
        </button>

        <button
          type="button"
          role="menuitem"
          onclick={() => handleExport("pdf")}
          class={EXPORT_ITEM_BASE}
        >
          <FileIcon size={14} class="shrink-0" />
          <span class="flex-1">PDF Документ</span>
          {#if $exportFormat === "pdf"}
            <span class="h-1.5 w-1.5 rounded-full bg-[var(--accent)]"></span>
          {/if}
        </button>

        <button
          type="button"
          role="menuitem"
          onclick={() => handleExport("docx")}
          class={EXPORT_ITEM_BASE}
        >
          <FileText size={14} class="shrink-0" />
          <span class="flex-1">DOCX Документ</span>
          {#if $exportFormat === "docx"}
            <span class="h-1.5 w-1.5 rounded-full bg-[var(--accent)]"></span>
          {/if}
        </button>

        <button
          type="button"
          role="menuitem"
          onclick={() => handleExport("png")}
          class={EXPORT_ITEM_BASE}
        >
          <Image size={14} class="shrink-0" />
          <span class="flex-1">PNG Изображение</span>
          {#if $exportFormat === "png"}
            <span class="h-1.5 w-1.5 rounded-full bg-[var(--accent)]"></span>
          {/if}
        </button>

        <div class="mx-1 my-1.5 h-px bg-[var(--border)]"></div>

        <div class="px-3 py-1.5">
          <Checkbox
            checked={openInNewTab}
            onToggle={() => (openInNewTab = !openInNewTab)}
          >
            <span
              class="flex items-center gap-1.5 text-[12px] text-[var(--text-secondary)]"
            >
              <ExternalLink size={13} />
              Открывать в новой вкладке
            </span>
          </Checkbox>
        </div>
      </div>
    {/if}
  </div>
</header>

{#if exportError}
  <div
    class="fixed inset-0 z-100 flex animate-fade-in items-center justify-center bg-black/60 p-4 backdrop-blur-[2px]"
    onclick={closeErrorModal}
    onkeydown={handleModalBackdropKeydown}
    role="dialog"
    aria-modal="true"
    aria-label="Окно ошибки экспорта"
    tabindex="-1"
  >
    <div
      class="relative w-full max-w-md animate-scale-in rounded-xl border border-[var(--error)]/40 bg-[var(--bg-dark)] p-6 shadow-[var(--shadow-lg)]"
      role="presentation"
      onclick={(event) => event.stopPropagation()}
      onkeydown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
        }
      }}
    >
      <span
        class="absolute left-0 top-6 h-9 w-0.75 rounded-r bg-[var(--error)]"
        aria-hidden="true"
      ></span>
      <div class="flex items-start gap-4">
        <div
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--error)]/40 bg-[var(--error)]/10"
        >
          <CircleAlert size={20} class="text-[var(--error)]" />
        </div>
        <div class="min-w-0 flex-1">
          <h3 class="mb-1 text-[15px] font-bold text-[var(--text-primary)]">
            Ошибка экспорта
          </h3>
          <p
            class="whitespace-pre-wrap text-sm leading-relaxed text-[var(--text-secondary)]"
          >
            {exportError}
          </p>
        </div>
      </div>
      <div class="mt-6 flex justify-end">
        <button
          type="button"
          onclick={closeErrorModal}
          class="h-9 rounded-md bg-[var(--accent)] px-4 text-sm font-semibold text-[var(--bg-darkest)] transition-all hover:bg-[var(--accent-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
        >
          Понятно
        </button>
      </div>
    </div>
  </div>
{/if}
