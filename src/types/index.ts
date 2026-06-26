export type ExportFormat = 'pdf' | 'docx' | 'png' | 'md' | 'txt';

export interface AttachedFile {
  id: string;
  name: string;
  size: number;
  type: 'image' | 'text';
  dataUrl?: string; // base64 для изображений
  content?: string; // содержимое для текстовых файлов
  ext?: string; // расширение файла
  includeInExport: boolean; // включать ли содержимое в финальный экспорт
  // Для изображений
  width?: number;
  height?: number;
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
  savedAt: string; // ISO timestamp
  version: string; // версия схемы для миграций
}

export interface Tag {
  id: string;
  name: string;
  value: string;
}