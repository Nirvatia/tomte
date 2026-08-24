export function dropzone(node: HTMLElement, onDrop: (files: File[]) => void) {
  let isDragging = false;

  function handleDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (!isDragging) {
      isDragging = true;
      node.classList.add(
        "bg-[var(--accent-dim)]",
        "ring-2",
        "ring-inset",
        "ring-[var(--accent)]",
      );
    }
  }

  function handleDragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    const related = event.relatedTarget as Node | null;
    if (!related || !node.contains(related)) {
      isDragging = false;
      node.classList.remove(
        "bg-[var(--accent-dim)]",
        "ring-2",
        "ring-inset",
        "ring-[var(--accent)]",
      );
    }
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    isDragging = false;
    node.classList.remove(
      "bg-[var(--accent-dim)]",
      "ring-2",
      "ring-inset",
      "ring-[var(--accent)]",
    );

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      onDrop(Array.from(files));
    }
  }

  node.addEventListener("dragover", handleDragOver);
  node.addEventListener("dragleave", handleDragLeave);
  node.addEventListener("drop", handleDrop);

  return {
    destroy() {
      node.removeEventListener("dragover", handleDragOver);
      node.removeEventListener("dragleave", handleDragLeave);
      node.removeEventListener("drop", handleDrop);
    },
  };
}
