import { writable, derived } from 'svelte/store';
import type { AttachedFile, ExportFormat } from '../types';

export const fileName = writable<string>('prompt');
export const exportFormat = writable<ExportFormat>('pdf');
export const attachedFiles = writable<AttachedFile[]>([]);

export const editorHtml = writable<string>('');

// UI State
export const isPreviewOpen = writable<boolean>(false);
export const isExtractorOpen = writable<boolean>(false);
export const isFileManagerOpen = writable<boolean>(false);

// Выбранные файлы (ID)
export const selectedFileIds = writable<Set<string>>(new Set());

// Производные сторы для статистики
export const totalFilesCount = derived(attachedFiles, ($files) => $files.length);

export const selectedFilesCount = derived(
  [attachedFiles, selectedFileIds],
  ([$files, $selectedIds]) => {
    return $files.filter((f) => $selectedIds.has(f.id)).length;
  }
);

export const textFilesCount = derived(
  attachedFiles,
  ($files) => $files.filter((f) => f.type === 'text').length
);

export const imageFilesCount = derived(
  attachedFiles,
  ($files) => $files.filter((f) => f.type === 'image').length
);