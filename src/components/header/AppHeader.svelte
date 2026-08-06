<!-- AppHeader.svelte -->
<script lang="ts">
  import {
    exportFormat,
    fileName,
    editorHtml,
    attachedFiles,
    projectTreeNodes,
    selectedProjectFiles,
    selectedFileIds,
  } from "../../stores";
  import type { ExportFormat } from "../../types";
  import {
    ChevronDown,
    FileText,
    Image,
    FileCode,
    File as FileIcon,
    Download,
    LoaderCircle,
    ExternalLink,
    CircleAlert,
  } from "@lucide/svelte";
  import AppLogo from "./AppLogo.svelte";
  import { exportFile } from "../../utils/export";
  import { getSelectedTreeFilesAsAttachments } from "../../utils/projectTree";

  let isFileMenuOpen = $state(false);
  let isExporting = $state(false);
  let exportError = $state<string | null>(null);
  let openInNewTab = $state(false);

  const formatLabels: Record<string, string> = {
    md: "Markdown",
    pdf: "PDF",
    docx: "DOCX",
    png: "PNG",
  };

  function toggleMenu(e: MouseEvent) {
    e.stopPropagation();
    isFileMenuOpen = !isFileMenuOpen;
  }

  function setFormat(format: ExportFormat) {
    exportFormat.set(format);
    isFileMenuOpen = false;
  }

  function closeMenu(e: MouseEvent) {
    if (!(e.target as HTMLElement).closest(".menu-container")) {
      isFileMenuOpen = false;
    }
  }

  function closeErrorModal() {
    exportError = null;
  }

  function handleModalBackdropKeydown(e: KeyboardEvent) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      closeErrorModal();
    }
  }

  async function handleExport() {
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

      await exportFile($exportFormat, $editorHtml, filesToExport, $fileName, {
        openInNewTab,
      });
    } catch (e) {
      const errorMessage =
        e instanceof Error ? e.message : "Неизвестная ошибка";

      if (
        errorMessage.includes("Слишком много") ||
        errorMessage.includes("Слишком большой")
      ) {
        console.warn("⚠️ Превышен лимит экспорта:", errorMessage);
      } else {
        console.error("❌ Ошибка экспорта:", e);
      }

      exportError = errorMessage;
    } finally {
      isExporting = false;
    }
  }
</script>

<svelte:window onclick={closeMenu} />

<header
  class="relative z-30 flex h-15 shrink-0 items-center justify-between gap-4 border-b border-line bg-[#131416] px-5"
>
  <!-- Лого + имя файла -->
  <div class="flex min-w-0 items-center gap-4">
    <AppLogo size="compact" />

    <div class="h-6 w-px bg-line"></div>

    <div
      class="flex h-9.5 items-center gap-2.5 rounded-md border border-line bg-inset px-3 transition-colors focus-within:border-amb/60"
    >
      <FileText size={14} class="shrink-0 text-txt3" />
      <input
        type="text"
        bind:value={$fileName}
        placeholder="Имя файла..."
        class="w-44 bg-transparent font-mono text-[13px] text-txt placeholder:text-txt3 focus:outline-none"
        aria-label="Имя файла"
      />
    </div>
  </div>

  <!-- Сплит-кнопка: выбор формата + экспорт -->
  <div class="menu-container relative flex items-stretch">
    <button
      type="button"
      onclick={toggleMenu}
      class="flex h-9.5 items-center gap-2 rounded-l-md border border-line2 bg-raised px-3.5 font-mono text-xs font-semibold uppercase tracking-wider transition-colors duration-150 {isFileMenuOpen
        ? 'border-amb/50 bg-raised2 text-amb'
        : 'text-txt2 hover:bg-raised2 hover:text-txt'}"
      aria-haspopup="menu"
      aria-expanded={isFileMenuOpen}
    >
      <FileIcon size={15} />
      <span>{formatLabels[$exportFormat]}</span>
      <ChevronDown
        size={13}
        class="transition-transform duration-150 {isFileMenuOpen
          ? 'rotate-180'
          : ''}"
      />
    </button>

    <button
      type="button"
      onclick={handleExport}
      disabled={isExporting}
      class="flex h-9.5 items-center gap-2 rounded-r-md bg-amb px-4 font-mono text-xs font-bold uppercase tracking-wider text-[#16130c] shadow-[0_2px_14px_rgba(255,160,40,0.28)] transition-all hover:brightness-105 active:translate-y-px disabled:pointer-events-none disabled:opacity-50"
    >
      {#if isExporting}
        <LoaderCircle size={15} class="animate-spin" />
        <span>Экспорт...</span>
      {:else}
        <Download size={15} />
        <span>Экспорт</span>
      {/if}
    </button>

    {#if isFileMenuOpen}
      <div
        role="menu"
        class="absolute right-0 top-full z-50 mt-2 w-72 animate-fade-in rounded-lg border border-line2 bg-raised p-1.5 shadow-drop"
      >
        <div
          class="px-3 pb-1.5 pt-2 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-txt3"
        >
          Экспортировать как
        </div>

        <button
          type="button"
          role="menuitem"
          onclick={() => setFormat("md")}
          class="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-[13px] font-medium transition-colors {$exportFormat ===
          'md'
            ? 'text-amb'
            : 'text-txt2 hover:bg-raised2 hover:text-txt'}"
        >
          <FileCode size={15} class="shrink-0" />
          <span class="flex-1">Markdown</span>
          {#if $exportFormat === "md"}
            <span class="h-2 w-2 rounded-xs bg-amb"></span>
          {/if}
        </button>

        <button
          type="button"
          role="menuitem"
          onclick={() => setFormat("pdf")}
          class="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-[13px] font-medium transition-colors {$exportFormat ===
          'pdf'
            ? 'text-amb'
            : 'text-txt2 hover:bg-raised2 hover:text-txt'}"
        >
          <FileCode size={15} class="shrink-0" />
          <span class="flex-1">PDF Документ</span>
          {#if $exportFormat === "pdf"}
            <span class="h-2 w-2 rounded-xs bg-amb"></span>
          {/if}
        </button>

        <button
          type="button"
          role="menuitem"
          onclick={() => setFormat("docx")}
          class="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-[13px] font-medium transition-colors {$exportFormat ===
          'docx'
            ? 'text-amb'
            : 'text-txt2 hover:bg-raised2 hover:text-txt'}"
        >
          <FileText size={15} class="shrink-0" />
          <span class="flex-1">DOCX Документ</span>
          {#if $exportFormat === "docx"}
            <span class="h-2 w-2 rounded-xs bg-amb"></span>
          {/if}
        </button>

        <button
          type="button"
          role="menuitem"
          onclick={() => setFormat("png")}
          class="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-[13px] font-medium transition-colors {$exportFormat ===
          'png'
            ? 'text-amb'
            : 'text-txt2 hover:bg-raised2 hover:text-txt'}"
        >
          <Image size={15} class="shrink-0" />
          <span class="flex-1">PNG Изображение</span>
          {#if $exportFormat === "png"}
            <span class="h-2 w-2 rounded-xs bg-amb"></span>
          {/if}
        </button>

        <div class="mx-1 my-1.5 h-px bg-line"></div>

        <div
          class="flex w-full cursor-pointer select-none items-center gap-2.5 rounded-md px-3 py-2 text-left transition-colors hover:bg-raised2"
          role="button"
          tabindex="0"
          onclick={(e) => {
            e.stopPropagation();
            openInNewTab = !openInNewTab;
          }}
          onkeydown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              e.stopPropagation();
              openInNewTab = !openInNewTab;
            }
          }}
        >
          <input
            type="checkbox"
            checked={openInNewTab}
            class="h-4 w-4 accent-amb pointer-events-none"
            tabindex="-1"
            aria-hidden="true"
          />
          <span
            class="flex flex-1 items-center gap-2 text-[13px] text-txt2 pointer-events-none"
          >
            <ExternalLink size={14} />
            Открывать PDF в новой вкладке
          </span>
        </div>
      </div>
    {/if}
  </div>
</header>

{#if exportError}
  <div
    class="fixed inset-0 z-100 flex animate-fade-in items-center justify-center bg-black/60 p-4 backdrop-blur-[2px]"
    role="button"
    tabindex="0"
    onclick={closeErrorModal}
    onkeydown={handleModalBackdropKeydown}
    aria-label="Закрыть окно ошибки"
  >
    <div
      class="relative w-full max-w-md animate-scale-in rounded-xl border border-red-200 bg-panel p-6 shadow-deep"
      role="presentation"
      onclick={(e) => e.stopPropagation()}
    >
      <span
        class="absolute left-0 top-6 h-9 w-0.75 rounded-r bg-red-600"
        aria-hidden="true"
      ></span>

      <div class="flex items-start gap-4">
        <div
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-red-200 bg-red-50"
        >
          <CircleAlert size={20} class="text-red-600" />
        </div>

        <div class="min-w-0 flex-1">
          <h3 class="mb-1 text-[15px] font-bold text-txt">Ошибка экспорта</h3>
          <p class="whitespace-pre-wrap text-sm leading-relaxed text-txt2">
            {exportError}
          </p>
        </div>
      </div>

      <div class="mt-6 flex justify-end">
        <button
          type="button"
          onclick={closeErrorModal}
          class="h-9 rounded-md bg-amb px-4 text-sm font-semibold text-[#16130c] transition-all hover:brightness-105 focus:outline-none focus:ring-2 focus:ring-amb/30"
        >
          Понятно
        </button>
      </div>
    </div>
  </div>
{/if}