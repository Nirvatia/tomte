/**
 * Перестановка элементов списка перетаскиванием (решение этапа 5).
 * Работает внутри одной группы: вкладку нельзя бросить в список файлов.
 * Над целью ставится data-drop="before|after" — по нему CSS рисует линию.
 */
export type DropPlace = "before" | "after";

export interface ReorderOptions {
  id: string;
  group: string;
  axis: "x" | "y";
  onDrop: (draggedId: string, targetId: string, place: DropPlace) => void;
}

const mimeFor = (group: string) => `application/x-tomte-${group}`;

export function reorderable(node: HTMLElement, options: ReorderOptions) {
  let current = options;
  node.draggable = true;

  const isOurDrag = (event: DragEvent) =>
    Array.from(event.dataTransfer?.types ?? []).includes(
      mimeFor(current.group),
    );

  function placeFor(event: DragEvent): DropPlace {
    const rect = node.getBoundingClientRect();
    const middle =
      current.axis === "x"
        ? rect.left + rect.width / 2
        : rect.top + rect.height / 2;
    const position = current.axis === "x" ? event.clientX : event.clientY;
    return position < middle ? "before" : "after";
  }

  function onDragStart(event: DragEvent) {
    if (!event.dataTransfer) return;
    event.dataTransfer.setData(mimeFor(current.group), current.id);
    event.dataTransfer.effectAllowed = "move";
    node.dataset.dragging = "true";
  }

  function onDragOver(event: DragEvent) {
    if (!isOurDrag(event)) return;
    event.preventDefault();
    event.dataTransfer!.dropEffect = "move";
    node.dataset.drop = placeFor(event);
  }

  function clearDrop() {
    delete node.dataset.drop;
  }

  function onDrop(event: DragEvent) {
    if (!isOurDrag(event)) return;
    event.preventDefault();
    const draggedId = event.dataTransfer!.getData(mimeFor(current.group));
    const place = placeFor(event);
    clearDrop();
    if (draggedId && draggedId !== current.id) {
      current.onDrop(draggedId, current.id, place);
    }
  }

  function onDragEnd() {
    delete node.dataset.dragging;
    clearDrop();
  }

  node.addEventListener("dragstart", onDragStart);
  node.addEventListener("dragover", onDragOver);
  node.addEventListener("dragleave", clearDrop);
  node.addEventListener("drop", onDrop);
  node.addEventListener("dragend", onDragEnd);

  return {
    update(next: ReorderOptions) {
      current = next;
    },
    destroy() {
      node.removeEventListener("dragstart", onDragStart);
      node.removeEventListener("dragover", onDragOver);
      node.removeEventListener("dragleave", clearDrop);
      node.removeEventListener("drop", onDrop);
      node.removeEventListener("dragend", onDragEnd);
    },
  };
}

/** Новый порядок id после переноса dragged к target. */
export function moveId(
  ids: string[],
  draggedId: string,
  targetId: string,
  place: DropPlace,
): string[] {
  if (draggedId === targetId || !ids.includes(targetId)) return ids;
  const without = ids.filter((id) => id !== draggedId);
  const targetIndex = without.indexOf(targetId);
  without.splice(
    place === "before" ? targetIndex : targetIndex + 1,
    0,
    draggedId,
  );
  return without;
}
