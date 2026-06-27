export function directoryPicker(node: HTMLInputElement) {
  node.setAttribute('webkitdirectory', '');
  node.setAttribute('directory', '');
  node.setAttribute('mozdirectory', '');
  
  return {
    destroy() {
      node.removeAttribute('webkitdirectory');
      node.removeAttribute('directory');
      node.removeAttribute('mozdirectory');
    },
  };
}