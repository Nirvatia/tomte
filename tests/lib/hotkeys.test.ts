import { describe, it, expect } from "vitest";

import { findHotkey, formatHotkey, matchesHotkey } from "../../src/lib/hotkeys";

function key(
  init: KeyboardEventInit & { code?: string },
  target?: HTMLElement,
) {
  const event = new KeyboardEvent("keydown", init);
  if (target) Object.defineProperty(event, "target", { value: target });
  return event;
}

describe("matchesHotkey", () => {
  it("Mod — это Ctrl на Windows/Linux и Cmd на Mac", () => {
    expect(
      matchesHotkey(key({ code: "KeyS", ctrlKey: true }), "Mod+S", false),
    ).toBe(true);
    expect(
      matchesHotkey(key({ code: "KeyS", metaKey: true }), "Mod+S", true),
    ).toBe(true);
    expect(
      matchesHotkey(key({ code: "KeyS", metaKey: true }), "Mod+S", false),
    ).toBe(false);
  });

  it("работает в русской раскладке: сравнивает физическую клавишу", () => {
    const event = key({ code: "KeyN", key: "т", ctrlKey: true, altKey: true });
    expect(matchesHotkey(event, "Mod+Alt+N", false)).toBe(true);
  });

  it("лишний модификатор — не совпадение", () => {
    expect(
      matchesHotkey(
        key({ code: "KeyS", ctrlKey: true, shiftKey: true }),
        "Mod+S",
        false,
      ),
    ).toBe(false);
    expect(
      matchesHotkey(
        key({ code: "KeyE", ctrlKey: true, shiftKey: true }),
        "Mod+Alt+E",
        false,
      ),
    ).toBe(false);
  });

  it("«?» сравнивается по символу и без модификаторов", () => {
    expect(matchesHotkey(key({ key: "?", shiftKey: true }), "?")).toBe(true);
    expect(matchesHotkey(key({ key: "?", ctrlKey: true }), "?")).toBe(false);
  });
});

describe("findHotkey", () => {
  it("при наборе текста «?» не перехватывается, а Ctrl+S — да", () => {
    const editor = document.createElement("div");
    editor.contentEditable = "true";
    document.body.append(editor);

    expect(findHotkey(key({ key: "?" }, editor), false)).toBeNull();
    expect(
      findHotkey(key({ code: "KeyS", ctrlKey: true }, editor), false)?.id,
    ).toBe("save");
    expect(findHotkey(key({ key: "?" }, document.body), false)?.id).toBe(
      "help",
    );
    editor.remove();
  });

  it("Ctrl+Shift+E (выравнивание по центру в редакторе) не занят", () => {
    expect(
      findHotkey(key({ code: "KeyE", ctrlKey: true, shiftKey: true }), false),
    ).toBeNull();
  });
});

describe("formatHotkey", () => {
  it("подписывает сочетания для Windows и Mac", () => {
    expect(formatHotkey("Mod+Alt+N", false)).toBe("Ctrl+Alt+N");
    expect(formatHotkey("Mod+Alt+N", true)).toBe("⌥⌘N");
    expect(formatHotkey("Ctrl+Shift+Tab", false)).toBe("Ctrl+Shift+Tab");
    expect(formatHotkey("?", false)).toBe("?");
  });
});
