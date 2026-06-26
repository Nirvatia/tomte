<script lang="ts">
  import { exportFormat, fileName, editorHtml, attachedFiles } from '../../stores';
  import type { ExportFormat } from '../../types';
  import {
    ChevronDown,
    FileText,
    Image,
    FileCode,
    File as FileIcon,
    Download,
    Loader2,
  } from '@lucide/svelte';
  import AppLogo from './AppLogo.svelte';
  import { exportFile } from '../../utils/export';

  let isFileMenuOpen = $state(false);
  let isExporting = $state(false);
  let exportError = $state<string | null>(null);

  const formatLabels: Record<string, string> = {
    pdf: 'PDF',
    docx: 'DOCX',
    png: 'PNG',
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
    if (!(e.target as HTMLElement).closest('.menu-container')) {
      isFileMenuOpen = false;
    }
  }

  async function handleExport() {
    if (isExporting) return;
    if (!$editorHtml.trim() && $attachedFiles.length === 0) {
      exportError = 'Нечего экспортировать';
      setTimeout(() => (exportError = null), 3000);
      return;
    }

    isExporting = true;
    exportError = null;

    try {
      await exportFile($exportFormat, $editorHtml, $attachedFiles, $fileName);
    } catch (e) {
      console.error('Export error:', e);
      exportError = `Ошибка: ${e instanceof Error ? e.message : 'неизвестная ошибка'}`;
      setTimeout(() => (exportError = null), 5000);
    } finally {
      isExporting = false;
    }
  }
</script>

<svelte:window onclick={closeMenu} />

<header class="bg-surface border-b border-slate-200 shadow-soft-sm px-6 py-2.5 flex items-center justify-between z-50 relative">
  <!-- Левая часть: Меню + Имя файла + Экспорт -->
  <div class="flex items-center gap-3">
    <!-- Меню Файл -->
    <div class="relative menu-container">
      <button
        onclick={toggleMenu}
        class="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-surface-tertiary transition-all duration-200 text-ink-secondary hover:text-ink font-medium"
        aria-haspopup="menu"
        aria-expanded={isFileMenuOpen}
      >
        <FileIcon size={16} />
        <span>Файл</span>
        <ChevronDown size={14} class="transition-transform {isFileMenuOpen ? 'rotate-180' : ''}" />
      </button>

      {#if isFileMenuOpen}
        <div
          role="menu"
          class="absolute top-full left-0 mt-2 w-56 bg-surface rounded-xl shadow-xl border border-slate-100 py-2 animate-fade-in z-50"
        >
          <div class="px-4 py-2 text-xs font-semibold text-ink-tertiary uppercase tracking-wider">
            Экспортировать как...
          </div>
          <button
            role="menuitem"
            onclick={() => setFormat('pdf')}
            class="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-brand-50 text-ink-secondary hover:text-brand-600 transition-colors"
          >
            <FileCode size={16} />
            <span>PDF Документ</span>
          </button>
          <button
            role="menuitem"
            onclick={() => setFormat('docx')}
            class="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-brand-50 text-ink-secondary hover:text-brand-600 transition-colors"
          >
            <FileText size={16} />
            <span>DOCX Документ</span>
          </button>
          <button
            role="menuitem"
            onclick={() => setFormat('png')}
            class="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-brand-50 text-ink-secondary hover:text-brand-600 transition-colors"
          >
            <Image size={16} />
            <span>PNG Изображение</span>
          </button>
        </div>
      {/if}
    </div>

    <!-- Разделитель -->
    <div class="w-px h-6 bg-slate-200"></div>

    <!-- Имя файла -->
    <div class="flex items-center gap-2 px-3 py-1.5 bg-surface-secondary border border-slate-200 rounded-lg hover:border-slate-300 transition-colors">
      <FileText size={14} class="text-ink-tertiary" />
      <input
        type="text"
        bind:value={$fileName}
        placeholder="Имя файла..."
        class="w-40 px-2 py-0.5 bg-transparent text-sm text-ink font-medium focus:outline-none focus:ring-1 focus:ring-brand-500/30 focus:border-brand-500 transition-all"
        aria-label="Имя файла"
      />
    </div>

    <!-- Разделитель -->
    <div class="w-px h-6 bg-slate-200"></div>

    <!-- Кнопка экспорта -->
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

      {#if exportError}
        <div class="absolute top-full left-0 mt-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600 whitespace-nowrap shadow-lg animate-fade-in z-50">
          {exportError}
        </div>
      {/if}
    </div>
  </div>

  <!-- Правая часть: Логотип -->
  <AppLogo size="compact" />
</header>