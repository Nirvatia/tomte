// File System Access API: в lib.dom из TypeScript нет showDirectoryPicker
// и асинхронного обхода папки. Описываем только то, чем пользуемся.

interface FileSystemDirectoryHandle {
  values(): AsyncIterableIterator<
    FileSystemDirectoryHandle | FileSystemFileHandle
  >;
}

interface Window {
  showDirectoryPicker?(options?: {
    mode?: "read" | "readwrite";
  }): Promise<FileSystemDirectoryHandle>;
}
