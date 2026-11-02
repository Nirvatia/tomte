// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/svelte";
import "@testing-library/jest-dom/vitest";
import { get } from "svelte/store";

import ContextMenuHost from "../../../src/components/ui/ContextMenuHost.svelte";
import {
  closeContextMenu,
  contextMenu,
  openContextMenu,
} from "../../../src/stores/contextMenu";

function open(
  items: Parameters<typeof openContextMenu>[1],
  target?: HTMLElement,
) {
  const el = target ?? document.createElement("button");
  if (!target) document.body.append(el);
  const event = new MouseEvent("contextmenu", {
    clientX: 10,
    clientY: 20,
    cancelable: true,
  });
  Object.defineProperty(event, "currentTarget", { value: el });
  openContextMenu(event, items);
  return { event, el };
}

describe("ContextMenuHost", () => {
  afterEach(() => closeContextMenu());

  it("показывает пункты и выполняет выбранный", async () => {
    const rename = vi.fn();
    render(ContextMenuHost);
    const { event } = open([
      { label: "Переименовать", onSelect: rename },
      { label: "Удалить", onSelect: vi.fn(), danger: true },
    ]);

    expect(event.defaultPrevented).toBe(true);
    await fireEvent.click(
      await screen.findByRole("menuitem", { name: "Переименовать" }),
    );

    expect(rename).toHaveBeenCalled();
    expect(get(contextMenu)).toBeNull();
  });

  it("фокус на первом пункте, стрелки ходят по пунктам, Escape закрывает", async () => {
    render(ContextMenuHost);
    const { el } = open([
      { label: "Первый", onSelect: vi.fn() },
      { label: "Второй", onSelect: vi.fn() },
    ]);

    const first = await screen.findByRole("menuitem", { name: "Первый" });
    await waitFor(() => expect(first).toHaveFocus());
    await fireEvent.keyDown(first, { key: "ArrowDown" });
    expect(screen.getByRole("menuitem", { name: "Второй" })).toHaveFocus();

    await fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
    expect(get(contextMenu)).toBeNull();
    expect(el).toHaveFocus();
  });

  it("с клавиатуры (без координат) ставит меню у элемента", () => {
    const el = document.createElement("button");
    document.body.append(el);
    el.getBoundingClientRect = () => ({ left: 100, bottom: 50 }) as DOMRect;
    const event = new MouseEvent("contextmenu", { clientX: 0, clientY: 0 });
    Object.defineProperty(event, "currentTarget", { value: el });

    openContextMenu(event, [{ label: "x", onSelect: vi.fn() }]);

    expect(get(contextMenu)).toMatchObject({ x: 116, y: 50 });
  });
});
