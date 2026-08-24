export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

export function sanitizeFileName(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, "").trim() || "prompt";
}

export function generateId(): string {
  return crypto.randomUUID();
}

export function pluralize(
  n: number,
  one: string,
  few: string,
  many: string,
): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}

export function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string" && error.length > 0) return error;
  return fallback;
}

export type FlushableAsync = (() => void) & {
  flush: () => Promise<void>;
  cancel: () => void;
};

export function createFlushableAsync(
  fn: () => Promise<void>,
  wait: number,
): FlushableAsync {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  let running: Promise<void> | null = null;
  let dirty = false;

  async function run(): Promise<void> {
    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
    }
    if (running) {
      await running;
      return;
    }
    if (!dirty) return;

    dirty = false;
    running = fn()
      .catch((error) => {
        console.error("Flushable async task failed:", error);
      })
      .finally(() => {
        running = null;
      });
    await running;
  }

  const schedule = (() => {
    dirty = true;
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => {
      timeout = null;
      void run();
    }, wait);
  }) as FlushableAsync;

  schedule.flush = async () => {
    await run();
  };

  schedule.cancel = () => {
    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
    }
    dirty = false;
  };

  return schedule;
}
