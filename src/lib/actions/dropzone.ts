export function dropzone(node: HTMLElement, onDrop: (files: File[]) => void) {
  let isDragging = false;

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) {
      isDragging = true;
      node.classList.add('bg-brand-50', 'ring-2', 'ring-inset', 'ring-brand-400');
    }
  }

  function handleDragLeave(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    const related = e.relatedTarget as Node | null;
    if (!related || !node.contains(related)) {
      isDragging = false;
      node.classList.remove('bg-brand-50', 'ring-2', 'ring-inset', 'ring-brand-400');
    }
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    isDragging = false;
    node.classList.remove('bg-brand-50', 'ring-2', 'ring-inset', 'ring-brand-400');
    
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      onDrop(Array.from(files));
    }
  }

  node.addEventListener('dragover', handleDragOver);
  node.addEventListener('dragleave', handleDragLeave);
  node.addEventListener('drop', handleDrop);

  return {
    destroy() {
      node.removeEventListener('dragover', handleDragOver);
      node.removeEventListener('dragleave', handleDragLeave);
      node.removeEventListener('drop', handleDrop);
    }
  };
}