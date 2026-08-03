export type ExportFormat = 'md' | 'pdf' | 'docx' | 'png' | 'md' | 'txt';

export interface AttachedFile {
  id: string;
  name: string;
  size: number;
  type: 'text' | 'image';
  content: string;
  dataUrl?: string;
  ext?: string;
  width?: number;
  height?: number;
  // Убрали includeInExport - теперь это определяется через selectedFileIds
}

export interface EditorHistoryState {
  html: string;
  text: string;
}

export interface AppSettings {
  fileName: string;
  exportFormat: ExportFormat;
}

export interface Draft {
  editorHtml: string;
  attachedFiles: AttachedFile[];
  fileName: string;
  exportFormat: ExportFormat;
  // Добавляем эти поля для полноценного автосохранения состояния
  projectTreeRootName?: string;
  selectedProjectFiles?: string[];
  savedAt: string; // ISO timestamp
  version: string; // версия схемы для миграций
}

export interface Tag {
  id: string;
  name: string;
  value: string;
}