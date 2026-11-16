<script lang="ts">
  import { t } from "$lib/i18n";
  import {
    Check,
    ChevronDown,
    CircleAlert,
    Download,
    ExternalLink,
    File as FileIcon,
    FileCode,
    FileText,
    FolderKanban,
    Image,
    LoaderCircle,
  } from "@lucide/svelte";

  import Checkbox from "../ui/Checkbox.svelte";
  import ModalShell from "../ui/ModalShell.svelte";
  import TemplateFillModal from "../templates/TemplateFillModal.svelte";
  import AppLogo from "./AppLogo.svelte";
  import SettingsMenu from "./SettingsMenu.svelte";

  import type { ExportFormat } from "../../types";
  import {
    activeFile,
    attachedFiles,
    editorHtml,
    exportFormat,
    filteredTreePathSet,
    isExportMenuOpen,
    isProjectManagerOpen,
    projectTreeNodes,
    selectedFileIds,
    selectedProjectFiles,
  } from "../../stores";
  import { isDesktop } from "$lib/media";

  import { exportFile } from "../../utils/export";
  import { ExportLimitError } from "../../utils/export/limits";
  import { excludeFilteredPaths } from "../../utils/treeFilter";
  import {
    findVariables,
    rememberValues,
    rememberedValues,
    substituteVariables,
  } from "../../utils/templates";
  import { menu } from "$lib/actions/menu";
  import { formatHotkey, hotkeyFor } from "$lib/hotkeys";
  import { labelAttachments } from "../../utils/files";
  import { getSelectedTreeFilesAsAttachments } from "../../utils/projectTree";

  let exportButton = $state<HTMLButtonElement | null>(null);
  let isExporting = $state(false);
  let exportError = $state<string | null>(null);
  let openInNewTab = $state(false);
  let exportMenuContainer = $state<HTMLDivElement | null>(null);

  // Этап 10.2: формат ждёт заполнения переменных шаблона.
  let pendingTemplateFormat = $state<ExportFormat | null>(null);
  let templateVariables = $state<string[]>([]);
  let templateInitial = $state<Record<string, string>>({});

  function toggleExportMenu(event: MouseEvent) {
    event.stopPropagation();
    isExportMenuOpen.update((open) => !open);
  }

  function handleClickOutside(event: MouseEvent) {
    if (
      $isExportMenuOpen &&
      exportMenuContainer &&
      !exportMenuContainer.contains(event.target as Node)
    ) {
      isExportMenuOpen.set(false);
    }
  }

  function closeErrorModal() {
    exportError = null;
  }

  async function handleExport(format: ExportFormat) {
    exportFormat.set(format);
    isExportMenuOpen.set(false);
    if (isExporting) return;

    // Переменные шаблона: сначала форма заполнения, потом выгрузка.
    const variables = findVariables($editorHtml);
    if (variables.length > 0) {
      templateVariables = variables;
      templateInitial = rememberedValues(variables);
      pendingTemplateFormat = format;
      return;
    }
    await doExport(format, $editorHtml);
  }

  function handleTemplateSubmit(values: Record<string, string>) {
    const format = pendingTemplateFormat;
    pendingTemplateFormat = null;
    if (!format) return;
    rememberValues(values);
    void doExport(format, substituteVariables($editorHtml, values));
  }

  function handleTemplateCancel() {
    pendingTemplateFormat = null;
  }

  async function doExport(format: ExportFormat, html: string) {
    if (isExporting) return;

    isExporting = true;
    exportError = null;

    try {
      // Метки считаем по всем вложениям: так [FILE_2] в тексте совпадёт
      // с подписью в экспорте, даже если отмечена только часть файлов.
      const selectedAttachments = labelAttachments(
        $attachedFiles.filter((f) => $selectedFileIds.has(f.id)),
        $attachedFiles,
      );
      const rawTreeFiles = await getSelectedTreeFilesAsAttachments(
        $projectTreeNodes,
        // Отсеянные фильтром (10.6) в выгрузку не идут, даже если отмечены раньше.
        excludeFilteredPaths($selectedProjectFiles, $filteredTreePathSet),
      );
      // У файлов дерева нет плейсхолдеров в тексте: подписываем их путём.
      const selectedTreeFiles = rawTreeFiles.map((f) => ({
        ...f,
        id: `tree_${f.id}`,
        label: null,
      }));
      const filesToExport = [...selectedAttachments, ...selectedTreeFiles];

      if (!html.trim() && filesToExport.length === 0) {
        throw new Error($t("export.nothing"));
      }

      const rawName = $activeFile?.name ?? "prompt";
      const exportName = rawName.replace(/\.[^/.]+$/, "");

      await exportFile(format, html, filesToExport, exportName, {
        openInNewTab,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : $t("common.unknownError");
      if (error instanceof ExportLimitError) {
        console.warn("Export limit exceeded:", errorMessage);
      } else {
        console.error("Export failed:", error);
      }
      exportError = errorMessage;
    } finally {
      isExporting = false;
    }
  }
</script>

<svelte:window onclick={handleClickOutside} />

<header
  class="flex h-[48px] shrink-0 items-center justify-between gap-4 border-b border-[var(--border)] bg-[var(--bg-dark)] px-4 text-ui text-[var(--text-secondary)]"
>
  <AppLogo size="compact" />

  <div class="flex items-center gap-3">
    <!-- Этап 9: на планшете и телефоне activity bar спрятан, проекты открываются отсюда. -->
    {#if !$isDesktop}
      <button
        type="button"
        onclick={() => isProjectManagerOpen.set(true)}
        class="icon-btn"
        aria-label={$t("activity.projects")}
        title={$t("projects.manager")}
      >
        <FolderKanban size={16} />
      </button>
    {/if}
    <SettingsMenu />
    <div data-tour="export" bind:this={exportMenuContainer} class="relative">
      <button
        type="button"
        onclick={toggleExportMenu}
        disabled={isExporting}
        class="btn btn-primary btn-sm"
        bind:this={exportButton}
        aria-haspopup="menu"
        aria-expanded={$isExportMenuOpen}
        aria-label={$t("export.button")}
        title={$t("export.exportHint", {
          keys: formatHotkey(hotkeyFor("export").keys),
        })}
      >
        {#if isExporting}
          <LoaderCircle size={14} class="animate-spin" />
        {:else}
          <Download size={14} />
        {/if}
        <span>{$t("export.button")}</span>
        <ChevronDown
          size={14}
          class="chev transition-transform duration-150 {$isExportMenuOpen
            ? 'rotate-180'
            : ''}"
        />
      </button>

      {#if $isExportMenuOpen}
        <div
          use:menu={{
            onClose: () => isExportMenuOpen.set(false),
            returnFocus: exportButton,
          }}
          role="menu"
          aria-label={$t("export.menu")}
          data-tour="export-menu"
          class="menu-panel absolute right-0 top-full z-[var(--layer-dropdown)] mt-2 w-64 animate-fade-in"
        >
          <button
            type="button"
            role="menuitem"
            onclick={() => handleExport("md")}
            class="menu-item"
          >
            <FileCode size={14} class="shrink-0" />
            <span class="flex-1">Markdown</span>
            {#if $exportFormat === "md"}
              <Check size={14} class="text-[var(--accent)]" />
            {/if}
          </button>

          <button
            type="button"
            role="menuitem"
            onclick={() => handleExport("pdf")}
            class="menu-item"
          >
            <FileIcon size={14} class="shrink-0" />
            <span class="flex-1">{$t("export.pdf")}</span>
            {#if $exportFormat === "pdf"}
              <Check size={14} class="text-[var(--accent)]" />
            {/if}
          </button>

          <button
            type="button"
            role="menuitem"
            onclick={() => handleExport("docx")}
            class="menu-item"
          >
            <FileText size={14} class="shrink-0" />
            <span class="flex-1">{$t("export.docxFormat")}</span>
            {#if $exportFormat === "docx"}
              <Check size={14} class="text-[var(--accent)]" />
            {/if}
          </button>

          <button
            type="button"
            role="menuitem"
            onclick={() => handleExport("docx-gost")}
            class="menu-item"
            title={$t("export.gostHint")}
          >
            <FileText size={14} class="shrink-0" />
            <span class="flex-1">{$t("export.gost")}</span>
            {#if $exportFormat === "docx-gost"}
              <Check size={14} class="text-[var(--accent)]" />
            {/if}
          </button>

          <button
            type="button"
            role="menuitem"
            onclick={() => handleExport("png")}
            class="menu-item"
          >
            <Image size={14} class="shrink-0" />
            <span class="flex-1">{$t("export.png")}</span>
            {#if $exportFormat === "png"}
              <Check size={14} class="text-[var(--accent)]" />
            {/if}
          </button>

          <div class="menu-sep"></div>

          <div class="px-3 py-1.5">
            <Checkbox
              checked={openInNewTab}
              onToggle={() => (openInNewTab = !openInNewTab)}
            >
              <span
                class="flex items-center gap-1.5 text-label text-[var(--text-secondary)]"
              >
                <ExternalLink size={13} />
                {$t("export.openInNewTab")}
              </span>
            </Checkbox>
          </div>
        </div>
      {/if}
    </div>
  </div>
</header>

{#if exportError}
  <ModalShell
    label={$t("export.errorDialog")}
    onClose={closeErrorModal}
    width="max-w-md"
  >
    <div class="p-6">
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
          <h3 class="mb-1 text-title font-bold text-[var(--text-primary)]">
            {$t("export.errorTitle")}
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
          class="btn btn-primary btn-md"
        >
          {$t("common.ok")}
        </button>
      </div>
    </div>
  </ModalShell>
{/if}

{#if pendingTemplateFormat}
  <TemplateFillModal
    variables={templateVariables}
    initial={templateInitial}
    onSubmit={handleTemplateSubmit}
    onCancel={handleTemplateCancel}
  />
{/if}
