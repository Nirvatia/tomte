import { describe, it, expect, vi, beforeEach } from "vitest";

const toastMock = vi.fn();
vi.mock("svelte-sonner", () => ({
  toast: (...args: unknown[]) => toastMock(...args),
}));
const flushMock = vi.fn().mockResolvedValue(undefined);
vi.mock("../../src/utils/projectActions", () => ({
  flushPendingEditorSave: () => flushMock(),
}));

/** Минимальные заглушки ServiceWorker API. */
class FakeTarget {
  private listeners = new Map<string, Array<() => void>>();
  addEventListener(type: string, fn: () => void) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), fn]);
  }
  emit(type: string) {
    for (const fn of this.listeners.get(type) ?? []) fn();
  }
}
class FakeWorker extends FakeTarget {
  state = "installing";
  postMessage = vi.fn();
}
class FakeRegistration extends FakeTarget {
  waiting: FakeWorker | null = null;
  installing: FakeWorker | null = null;
}

let container: FakeTarget & { controller: object | null };
const reload = vi.fn();

beforeEach(() => {
  vi.resetModules();
  toastMock.mockClear();
  flushMock.mockClear();
  reload.mockClear();
  container = Object.assign(new FakeTarget(), {
    controller: {} as object | null,
  });
  Object.defineProperty(navigator, "serviceWorker", {
    value: container,
    configurable: true,
  });
  Object.defineProperty(window, "location", {
    value: { reload },
    configurable: true,
  });
});

async function load() {
  return import("../../src/lib/serviceWorker");
}

describe("обновление приложения", () => {
  it("установленная новая версия предлагает обновиться", async () => {
    const { watchForUpdates } = await load();
    const registration = new FakeRegistration();
    watchForUpdates(registration as unknown as ServiceWorkerRegistration);

    const worker = new FakeWorker();
    registration.installing = worker;
    registration.emit("updatefound");
    worker.state = "installed";
    worker.emit("statechange");

    expect(toastMock).toHaveBeenCalledTimes(1);
    expect(toastMock.mock.calls[0][0]).toBe("Доступна новая версия Томте");
  });

  it("«Обновить» сохраняет текст, активирует версию и перезагружает", async () => {
    const { watchForUpdates, SKIP_WAITING_MESSAGE } = await load();
    const registration = new FakeRegistration();
    const worker = new FakeWorker();
    registration.waiting = worker;
    watchForUpdates(registration as unknown as ServiceWorkerRegistration);

    const { action } = toastMock.mock.calls[0][1];
    expect(action.label).toBe("Обновить");
    action.onClick();
    await vi.waitFor(() =>
      expect(worker.postMessage).toHaveBeenCalledWith({
        type: SKIP_WAITING_MESSAGE,
      }),
    );
    expect(flushMock).toHaveBeenCalled();

    container.emit("controllerchange");
    expect(reload).toHaveBeenCalled();
  });

  it("первая установка — без уведомления и без перезагрузки", async () => {
    container.controller = null;
    const { watchForUpdates } = await load();
    const registration = new FakeRegistration();
    watchForUpdates(registration as unknown as ServiceWorkerRegistration);

    const worker = new FakeWorker();
    registration.installing = worker;
    registration.emit("updatefound");
    worker.state = "installed";
    worker.emit("statechange");
    container.emit("controllerchange");

    expect(toastMock).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });
});
