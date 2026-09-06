// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { dropzone } from "../../../src/lib/actions/dropzone";

const DRAG_CLASSES = [
  "bg-[var(--accent-dim)]",
  "ring-2",
  "ring-inset",
  "ring-[var(--accent)]",
];

function createNode() {
  const node = document.createElement("div");
  document.body.appendChild(node);
  return node;
}

function makeEvent(type: string, props: Record<string, unknown> = {}) {
  const event = new Event(type, {
    bubbles: true,
    cancelable: true,
  });

  for (const [key, value] of Object.entries(props)) {
    Object.defineProperty(event, key, {
      value,
      configurable: true,
    });
  }

  return event;
}

describe("dropzone", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("добавляет визуальную подсветку при dragover", () => {
    const node = createNode();
    const onDrop = vi.fn();

    dropzone(node, onDrop);

    node.dispatchEvent(makeEvent("dragover"));

    for (const className of DRAG_CLASSES) {
      expect(node.classList.contains(className)).toBe(true);
    }
  });

  it("убирает подсветку при выходе за пределы зоны", () => {
    const node = createNode();
    const onDrop = vi.fn();

    dropzone(node, onDrop);

    node.dispatchEvent(makeEvent("dragover"));

    for (const className of DRAG_CLASSES) {
      expect(node.classList.contains(className)).toBe(true);
    }

    node.dispatchEvent(
      makeEvent("dragleave", {
        relatedTarget: null,
      }),
    );

    for (const className of DRAG_CLASSES) {
      expect(node.classList.contains(className)).toBe(false);
    }
  });

  it("не убирает подсветку, если курсор перешёл на дочерний элемент", () => {
    const node = createNode();
    const child = document.createElement("span");
    node.appendChild(child);

    const onDrop = vi.fn();

    dropzone(node, onDrop);

    node.dispatchEvent(makeEvent("dragover"));

    node.dispatchEvent(
      makeEvent("dragleave", {
        relatedTarget: child,
      }),
    );

    for (const className of DRAG_CLASSES) {
      expect(node.classList.contains(className)).toBe(true);
    }
  });

  it("вызывает onDrop с файлами при дропе", () => {
    const node = createNode();
    const onDrop = vi.fn();

    dropzone(node, onDrop);

    const file = new File(["content"], "a.txt", {
      type: "text/plain",
    });

    node.dispatchEvent(
      makeEvent("drop", {
        dataTransfer: {
          files: [file],
        },
      }),
    );

    expect(onDrop).toHaveBeenCalledWith([file]);
  });

  it("не вызывает onDrop, если файлов нет", () => {
    const node = createNode();
    const onDrop = vi.fn();

    dropzone(node, onDrop);

    node.dispatchEvent(
      makeEvent("drop", {
        dataTransfer: {
          files: [],
        },
      }),
    );

    expect(onDrop).not.toHaveBeenCalled();
  });

  it("убирает подсветку после дропа", () => {
    const node = createNode();
    const onDrop = vi.fn();

    dropzone(node, onDrop);

    node.dispatchEvent(makeEvent("dragover"));

    for (const className of DRAG_CLASSES) {
      expect(node.classList.contains(className)).toBe(true);
    }

    const file = new File(["content"], "a.txt", {
      type: "text/plain",
    });

    node.dispatchEvent(
      makeEvent("drop", {
        dataTransfer: {
          files: [file],
        },
      }),
    );

    for (const className of DRAG_CLASSES) {
      expect(node.classList.contains(className)).toBe(false);
    }
  });

  it("после destroy перестаёт реагировать на события", () => {
    const node = createNode();
    const onDrop = vi.fn();

    const action = dropzone(node, onDrop);

    action.destroy();

    node.dispatchEvent(makeEvent("dragover"));

    for (const className of DRAG_CLASSES) {
      expect(node.classList.contains(className)).toBe(false);
    }
  });
});