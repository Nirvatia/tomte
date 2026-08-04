export type ExportFormat = "md" | "pdf" | "docx" | "png" | "md" | "txt";

export interface AttachedFile {
  id: string;
  name: string;
  size: number;
  type: "text" | "image";
  content?: string;
  dataUrl?: string;
  ext?: string;
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
  projectTreeRootName?: string;
  selectedProjectFiles?: string[];
  savedAt: string;
  version: string;
}

export interface Tag {
  id: string;
  name: string;
  value: string;
}
