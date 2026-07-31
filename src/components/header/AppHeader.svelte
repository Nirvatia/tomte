<script lang="ts">
  import {
    exportFormat,
    fileName,
    editorHtml,
    attachedFiles,
  } from "../../stores";
  import type { ExportFormat } from "../../types";
  import {
    ChevronDown,
    FileText,
    Image,
    FileCode,
    File as FileIcon,
    Download,
    Loader2,
    ExternalLink,
    AlertCircle, // <-- Добавили иконку для модалки
  } from "@lucide/svelte";
  import AppLogo from "./AppLogo.svelte";
  import { exportFile } from "../../utils/export";

  import {
    projectTreeNodes,
    selectedProjectFiles,
    selectedFileIds,
  } from "../../stores";
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

  async function handleExport() {
    if (isExporting) return;

    isExporting = true;
    exportError = null;

    try {
      // 1. Берем ТОЛЬКО выбранные файлы из панели вложений
      const selectedAttachments = $attachedFiles.filter(f => $selectedFileIds.has(f.id));

      // 2. Берем ТОЛЬКО выбранные файлы из дерева проекта
      // (Функция уже возвращает только выбранные, но мы добавим префикс ID для безопасности)
      const rawTreeFiles = await getSelectedTreeFilesAsAttachments(
        $projectTreeNodes,
        $selectedProjectFiles
      );
      
      // Гарантируем уникальность ID, чтобы они не пересеклись с attachments
      const selectedTreeFiles = rawTreeFiles.map(f => ({
        ...f,
        id: `tree_${f.id}` 
      }));

      // 3. Объединяем в один чистый массив для экспорта
      const filesToExport = [...selectedAttachments, ...selectedTreeFiles];

      // 4. Проверка
      if (!$editorHtml.trim() && filesToExport.length === 0) {
        throw new Error("Нечего экспортировать. Добавьте текст или выберите файлы.");
      }

      // 5. Передаем в экспорт УЖЕ отфильтрованный массив. 
      // Модули экспорта больше не должны ничего фильтровать!
      await exportFile($exportFormat, $editorHtml, filesToExport, $fileName, {
        openInNewTab,
      });
    } catch (e) {
      console.error("Export error:", e);
      const errorMessage = e instanceof Error ? e.message : "Неизвестная ошибка";
      
      if (errorMessage.includes("Слишком много") || errorMessage.includes("Слишком большой")) {
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
  class="bg-surface border-b border-slate-200 shadow-soft-sm px-6 py-2.5 flex items-center justify-between shrink-0"
>
  <div class="flex items-center gap-3">
    <div class="relative menu-container">
      <button
        onclick={toggleMenu}
        class="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-surface-tertiary transition-all duration-200 text-ink-secondary hover:text-ink font-medium"
        aria-haspopup="menu"
        aria-expanded={isFileMenuOpen}
      >
        <FileIcon size={16} />
        <span>Файл</span>
        <ChevronDown
          size={14}
          class="transition-transform {isFileMenuOpen ? 'rotate-180' : ''}"
        />
      </button>

      {#if isFileMenuOpen}
        <div
          role="menu"
          class="absolute top-full left-0 mt-2 w-56 bg-surface rounded-xl shadow-xl border border-slate-100 py-2 animate-fade-in z-50"
        >
          <div
            class="px-4 py-2 text-xs font-semibold text-ink-tertiary uppercase tracking-wider"
          >
            Экспортировать как...
          </div>
          <button
            role="menuitem"
            onclick={() => setFormat("md")}
            class="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-brand-50 text-ink-secondary hover:text-brand-600 transition-colors font-semibold"
          >
            <FileCode size={16} />
            <span>Markdown</span>
          </button>
          <button
            role="menuitem"
            onclick={() => setFormat("pdf")}
            class="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-brand-50 text-ink-secondary hover:text-brand-600 transition-colors"
          >
            <FileCode size={16} />
            <span>PDF Документ</span>
          </button>
          <button
            role="menuitem"
            onclick={() => setFormat("docx")}
            class="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-brand-50 text-ink-secondary hover:text-brand-600 transition-colors"
          >
            <FileText size={16} />
            <span>DOCX Документ</span>
          </button>
          <button
            role="menuitem"
            onclick={() => setFormat("png")}
            class="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-brand-50 text-ink-secondary hover:text-brand-600 transition-colors"
          >
            <Image size={16} />
            <span>PNG Изображение</span>
          </button>

          <div class="border-t border-slate-100 my-1"></div>

          <label
            class="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-tertiary cursor-pointer transition-colors select-none"
            onclick={(e) => e.stopPropagation()}
          >
            <input
              type="checkbox"
              bind:checked={openInNewTab}
              class="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
            />
            <span
              class="text-sm text-ink-secondary flex items-center gap-1.5 pointer-events-none"
            >
              <ExternalLink size={14} />
              Открыть PDF в новой вкладке
            </span>
          </label>
        </div>
      {/if}
    </div>

    <div class="w-px h-6 bg-slate-200"></div>

    <div
      class="flex items-center gap-2 px-3 py-1.5 bg-surface-secondary border border-slate-200 rounded-lg hover:border-slate-300 transition-colors"
    >
      <FileText size={14} class="text-ink-tertiary" />
      <input
        type="text"
        bind:value={$fileName}
        placeholder="Имя файла..."
        class="w-40 px-2 py-0.5 bg-transparent text-sm text-ink font-medium focus:outline-none focus:ring-1 focus:ring-brand-500/30 focus:border-brand-500 transition-all"
        aria-label="Имя файла"
      />
    </div>

    <div class="w-px h-6 bg-slate-200"></div>

    <div class="relative">
      <button
        onclick={handleExport}
        disabled={isExporting}
        class="inline-flex items-center gap-2 px-4 py-2 bg-brand-500 text-white rounded-lg font-medium text-sm hover:bg-brand-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {#if isExporting}
          <Loader2 size={16} class="animate-spin" />
          <span>Экспорт...</span>
        {:else}
          <Download size={16} />
          <span>Экспорт в {formatLabels[$exportFormat]}</span>
        {/if}
      </button>
    </div>
  </div>

  <AppLogo size="compact" />
</header>

<!-- ========================================== -->
<!-- МИНИ-МОДАЛЬНОЕ ОКНО ОШИБКИ -->
<!-- ========================================== -->
{#if exportError}
  <!-- Затемненный фон (закрывается по клику) -->
  <div
    class="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in"
    onclick={() => (exportError = null)}
  >
    <!-- Само окно (клик внутри не закрывает его) -->
    <div
      class="bg-surface border border-red-200 rounded-2xl shadow-2xl max-w-md w-full p-6 animate-scale-in"
      onclick={(e) => e.stopPropagation()}
    >
      <div class="flex items-start gap-4">
        <!-- Иконка ошибки -->
        <div
          class="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center shrink-0"
        >
          <AlertCircle size={20} class="text-red-600" />
        </div>

        <!-- Текст ошибки -->
        <div class="flex-1">
          <h3 class="text-base font-bold text-ink mb-1">Ошибка экспорта</h3>
          <p
            class="text-sm text-ink-secondary leading-relaxed whitespace-pre-wrap"
          >
            {exportError}
          </p>
        </div>
      </div>

      <!-- Кнопка закрытия -->
      <div class="mt-6 flex justify-end">
        <button
          onclick={() => (exportError = null)}
          class="px-4 py-2 bg-brand-500 text-white text-sm font-medium rounded-lg hover:bg-brand-600 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500/30"
        >
          Понятно
        </button>
      </div>
    </div>
  </div>
{/if}
