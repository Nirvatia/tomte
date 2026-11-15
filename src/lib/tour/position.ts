/**
 * Этап 5.8. Геометрия обучающего тура: куда поставить подсказку
 * относительно подсвеченного элемента и куда — метку «Нажмите сюда».
 * Чистые функции без DOM, чтобы их можно было проверить юнит-тестами.
 */

export interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface Size {
  width: number;
  height: number;
}

export type Side = "top" | "bottom" | "left" | "right";

export interface PopoverPlacement {
  top: number;
  left: number;
  /**
   * С какой стороны цели стоит подсказка. «inside» — цель слишком большая,
   * подсказка лежит поверх её нижней части; «center» — цели нет.
   */
  side: Side | "inside" | "center";
  /** Смещение стрелки вдоль края подсказки (px от её начала) или null. */
  arrow: number | null;
}

/** Ширина, ниже которой подсказка становится шторкой у края экрана. */
export const SHEET_BREAKPOINT = 640;

const ARROW_INSET = 18;

const clamp = (value: number, min: number, max: number) =>
  max < min ? min : Math.min(Math.max(value, min), max);

const OPPOSITE: Record<Side, Side> = {
  top: "bottom",
  bottom: "top",
  left: "right",
  right: "left",
};

/** Порядок перебора сторон: сначала предпочтительные, потом остальные. */
function sidesInOrder(prefer: Side[]): Side[] {
  const all: Side[] = ["bottom", "right", "top", "left"];
  return [...prefer, ...all.filter((side) => !prefer.includes(side))];
}

function coordsFor(
  side: Side,
  target: Rect,
  size: Size,
  gap: number,
): { top: number; left: number } {
  switch (side) {
    case "bottom":
      return {
        top: target.top + target.height + gap,
        left: target.left + target.width / 2 - size.width / 2,
      };
    case "top":
      return {
        top: target.top - gap - size.height,
        left: target.left + target.width / 2 - size.width / 2,
      };
    case "right":
      return {
        top: target.top + target.height / 2 - size.height / 2,
        left: target.left + target.width + gap,
      };
    case "left":
      return {
        top: target.top + target.height / 2 - size.height / 2,
        left: target.left - gap - size.width,
      };
  }
}

/** Помещается ли подсказка с этой стороны (по главной оси). */
function fitsOnSide(
  side: Side,
  target: Rect,
  size: Size,
  viewport: Size,
  gap: number,
  margin: number,
): boolean {
  switch (side) {
    case "bottom":
      return (
        target.top + target.height + gap + size.height <=
        viewport.height - margin
      );
    case "top":
      return target.top - gap - size.height >= margin;
    case "right":
      return (
        target.left + target.width + gap + size.width <= viewport.width - margin
      );
    case "left":
      return target.left - gap - size.width >= margin;
  }
}

export interface PlacePopoverOptions {
  target: Rect | null;
  popover: Size;
  viewport: Size;
  prefer?: Side[];
  /** Зазор между целью и подсказкой (место под стрелку). */
  gap?: number;
  /** Минимальный отступ от краёв окна. */
  margin?: number;
}

export function placePopover({
  target,
  popover,
  viewport,
  prefer = [],
  gap = 14,
  margin = 12,
}: PlacePopoverOptions): PopoverPlacement {
  const maxLeft = viewport.width - margin - popover.width;
  const maxTop = viewport.height - margin - popover.height;

  if (!target) {
    return {
      top: clamp((viewport.height - popover.height) / 2, margin, maxTop),
      left: clamp((viewport.width - popover.width) / 2, margin, maxLeft),
      side: "center",
      arrow: null,
    };
  }

  for (const side of sidesInOrder(prefer)) {
    if (!fitsOnSide(side, target, popover, viewport, gap, margin)) continue;
    const raw = coordsFor(side, target, popover, gap);
    const top = clamp(raw.top, margin, maxTop);
    const left = clamp(raw.left, margin, maxLeft);
    // Стрелка смотрит в центр цели, но не вылезает на скруглённые углы.
    const arrow =
      side === "top" || side === "bottom"
        ? clamp(
            target.left + target.width / 2 - left,
            ARROW_INSET,
            popover.width - ARROW_INSET,
          )
        : clamp(
            target.top + target.height / 2 - top,
            ARROW_INSET,
            popover.height - ARROW_INSET,
          );
    return { top, left, side, arrow };
  }

  // Цель занимает почти весь экран (редактор): кладём подсказку
  // внутрь, к её нижнему краю — там обычно пусто.
  const visibleBottom = Math.min(target.top + target.height, viewport.height);
  return {
    top: clamp(visibleBottom - popover.height - 24, margin, maxTop),
    left: clamp(
      target.left + target.width / 2 - popover.width / 2,
      margin,
      maxLeft,
    ),
    side: "inside",
    arrow: null,
  };
}

/**
 * Узкий экран: подсказка — шторка у верхнего или нижнего края.
 * Ставим её с той стороны, где цели нет.
 */
export function sheetEdge(
  target: Rect | null,
  viewport: Size,
): "top" | "bottom" {
  if (!target) return "bottom";
  const center = target.top + target.height / 2;
  return center > viewport.height / 2 ? "top" : "bottom";
}

export interface PlaceBadgeOptions {
  target: Rect;
  badge: Size;
  viewport: Size;
  /** Где стоит подсказка: метку ставим с другой стороны, чтобы не перекрывать. */
  avoid: Side | "inside" | "center" | "sheet-top" | "sheet-bottom";
  gap?: number;
  margin?: number;
  /**
   * Сразу внутрь цели, в левый верхний угол: для поля ввода, где метка
   * «Пишите здесь» должна стоять у курсора, а не снаружи.
   */
  inside?: boolean;
  /** Прямоугольник подсказки: метка не должна под неё залезать. */
  obstacle?: Rect | null;
}

function intersects(a: Rect, b: Rect): boolean {
  return (
    a.left < b.left + b.width &&
    b.left < a.left + a.width &&
    a.top < b.top + b.height &&
    b.top < a.top + a.height
  );
}

/** Метка «Нажмите сюда» рядом с целью. */
export function placeBadge({
  target,
  badge,
  viewport,
  avoid,
  gap = 8,
  margin = 8,
  inside = false,
  obstacle = null,
}: PlaceBadgeOptions): { top: number; left: number; side: Side | "inside" } {
  const maxLeft = viewport.width - margin - badge.width;
  const maxTop = viewport.height - margin - badge.height;

  if (inside) {
    return {
      top: clamp(target.top + gap, margin, maxTop),
      left: clamp(target.left + gap * 3, margin, maxLeft),
      side: "inside",
    };
  }

  let order: Side[];
  if (avoid === "sheet-top") order = ["bottom", "top"];
  else if (avoid === "sheet-bottom") order = ["top", "bottom"];
  else if (avoid === "inside" || avoid === "center") order = ["top", "bottom"];
  else if (avoid === "left" || avoid === "right")
    order = [OPPOSITE[avoid], "top", "bottom"];
  else order = [OPPOSITE[avoid], "right", "left"];

  for (const side of order) {
    if (!fitsOnSide(side, target, badge, viewport, gap, margin)) continue;
    const raw = coordsFor(side, target, badge, gap);
    const spot = {
      top: clamp(raw.top, margin, maxTop),
      left: clamp(raw.left, margin, maxLeft),
    };
    if (obstacle && intersects({ ...spot, ...badge }, obstacle)) continue;
    return { ...spot, side };
  }

  // Снаружи места нет — внутри цели, у верхнего края.
  return {
    top: clamp(target.top + gap, margin, maxTop),
    left: clamp(
      target.left + target.width / 2 - badge.width / 2,
      margin,
      maxLeft,
    ),
    side: "inside",
  };
}

/** Пересечение прямоугольника с окном (цель может частично уходить за край). */
export function clipToViewport(rect: Rect, viewport: Size): Rect | null {
  const left = Math.max(rect.left, 0);
  const top = Math.max(rect.top, 0);
  const right = Math.min(rect.left + rect.width, viewport.width);
  const bottom = Math.min(rect.top + rect.height, viewport.height);
  if (right - left < 2 || bottom - top < 2) return null;
  return { top, left, width: right - left, height: bottom - top };
}

/** Прямоугольник с отступом во все стороны. */
export function inflate(rect: Rect, by: number): Rect {
  return {
    top: rect.top - by,
    left: rect.left - by,
    width: rect.width + by * 2,
    height: rect.height + by * 2,
  };
}
