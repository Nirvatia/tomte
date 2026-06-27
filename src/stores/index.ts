import { writable, derived } from 'svelte/store';
import type { AttachedFile, ExportFormat } from '../types';
import type { TreeNode } from '../utils/projectTree';

export const fileName = writable<string>('prompt');
export const exportFormat = writable<ExportFormat>('pdf');
export const attachedFiles = writable<AttachedFile[]>([]);

export const editorHtml = writable<string>('');

// UI State
export const isPreviewOpen = writable<boolean>(false);
export const isExtractorOpen = writable<boolean>(false);
export const isFileManagerOpen = writable<boolean>(false);
export const isProjectTreeOpen = writable<boolean>(false);

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

// Project tree state
export const projectTreeNodes = writable<TreeNode[]>([]);
export const projectTreeRootName = writable<string>('');
export const projectTreeString = writable<string>('');

export const textFilesCount = derived(
  attachedFiles,
  ($files) => $files.filter((f) => f.type === 'text').length
);

export const imageFilesCount = derived(
  attachedFiles,
  ($files) => $files.filter((f) => f.type === 'image').length
);