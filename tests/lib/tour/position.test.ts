import { describe, it, expect } from "vitest";

import {
  clipToViewport,
  placeBadge,
  placePopover,
  sheetEdge,
  type Rect,
} from "../../../src/lib/tour/position";

const viewport = { width: 1440, height: 900 };
const popover = { width: 360, height: 220 };
const right = (r: Rect) => r.left + r.width;
const bottom = (r: Rect) => r.top + r.height;

describe("placePopover", () => {
  it("без цели — по центру, без стрелки", () => {
    const place = placePopover({ target: null, popover, viewport });
    expect(place.side).toBe("center");
    expect(place.arrow).toBeNull();
    expect(place.left).toBe((1440 - 360) / 2);
    expect(place.top).toBe((900 - 220) / 2);
  });

  it("ставит с предпочтительной стороны, если помещается", () => {
    const target = { top: 50, left: 290, width: 36, height: 36 };
    const place = placePopover({
      target,
      popover,
      viewport,
      prefer: ["right"],
      gap: 14,
    });
    expect(place.side).toBe("right");
    expect(place.left).toBe(right(target) + 14);
  });

  it("переворачивается, если с предпочтительной стороны нет места", () => {
    // Кнопка в правом нижнем углу: снизу и справа места нет.
    const target = { top: 870, left: 1260, width: 170, height: 28 };
    const place = placePopover({
      target,
      popover,
      viewport,
      prefer: ["bottom", "right"],
    });
    expect(place.side).toBe("top");
    expect(bottom({ ...place, ...popover })).toBeLessThanOrEqual(target.top);
  });

  it("прижимает к краю окна и направляет стрелку в центр цели", () => {
    const target = { top: 4, left: 1300, width: 128, height: 40 };
    const place = placePopover({ target, popover, viewport, margin: 12 });
    expect(place.side).toBe("bottom");
    expect(place.left + popover.width).toBeLessThanOrEqual(1440 - 12);
    // Стрелка смотрит в центр цели (1364), а не в центр подсказки.
    expect(place.left + (place.arrow ?? 0)).toBeCloseTo(1364);
  });

  it("стрелка не вылезает на скруглённые углы", () => {
    const target = { top: 4, left: 1420, width: 16, height: 30 };
    const place = placePopover({ target, popover, viewport });
    expect(place.arrow).toBeLessThanOrEqual(popover.width - 18);
  });

  it("огромная цель: подсказка внутри, у нижнего края", () => {
    const target = { top: 138, left: 378, width: 1056, height: 652 };
    const place = placePopover({ target, popover, viewport });
    expect(place.side).toBe("inside");
    expect(place.arrow).toBeNull();
    expect(bottom({ ...place, ...popover })).toBeLessThanOrEqual(
      bottom(target),
    );
  });
});

describe("sheetEdge", () => {
  const phone = { width: 390, height: 844 };
  it("цель вверху — шторка снизу", () => {
    expect(sheetEdge({ top: 6, left: 250, width: 36, height: 36 }, phone)).toBe(
      "bottom",
    );
  });
  it("цель внизу — шторка сверху", () => {
    expect(
      sheetEdge({ top: 816, left: 206, width: 174, height: 29 }, phone),
    ).toBe("top");
  });
  it("без цели — снизу", () => {
    expect(sheetEdge(null, phone)).toBe("bottom");
  });
});

describe("placeBadge", () => {
  const badge = { width: 130, height: 30 };
  const target = { top: 54, left: 289, width: 36, height: 36 };

  it("подсказка снизу — метка сверху цели", () => {
    const place = placeBadge({ target, badge, viewport, avoid: "bottom" });
    expect(place.side).toBe("top");
    expect(place.top + badge.height).toBeLessThanOrEqual(target.top);
  });

  it("подсказка справа — метка слева", () => {
    const place = placeBadge({ target, badge, viewport, avoid: "right" });
    expect(place.side).toBe("left");
    expect(place.left + badge.width).toBeLessThanOrEqual(target.left);
  });

  it("обходит прямоугольник подсказки", () => {
    // Слева места нет, сверху мешает подсказка — остаётся низ.
    const edge = { top: 54, left: 20, width: 36, height: 36 };
    const obstacle = { top: 0, left: 0, width: 400, height: 52 };
    const place = placeBadge({
      target: edge,
      badge,
      viewport,
      avoid: "right",
      obstacle,
    });
    expect(place.side).toBe("bottom");
  });

  it("поле ввода — внутри, у левого верхнего угла", () => {
    const editor = { top: 138, left: 378, width: 1056, height: 652 };
    const place = placeBadge({
      target: editor,
      badge,
      viewport,
      avoid: "inside",
      inside: true,
    });
    expect(place.side).toBe("inside");
    expect(place.top).toBeGreaterThan(editor.top);
    expect(place.left).toBeGreaterThan(editor.left);
  });
});

describe("clipToViewport", () => {
  it("обрезает выходящую за край цель", () => {
    expect(
      clipToViewport(
        { top: -10, left: 1400, width: 100, height: 50 },
        viewport,
      ),
    ).toEqual({ top: 0, left: 1400, width: 40, height: 40 });
  });
  it("цель за экраном — null", () => {
    expect(
      clipToViewport({ top: 0, left: 1500, width: 100, height: 50 }, viewport),
    ).toBeNull();
  });
});
