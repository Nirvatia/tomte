<script lang="ts">
  import { Upload } from '@lucide/svelte';
  import { createEventDispatcher } from 'svelte';

  let dropZoneActive = $state(false);
  let fileInput: HTMLInputElement;

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    dropZoneActive = false;
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      handleFiles(files);
    }
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    dropZoneActive = true;
  }

  function handleDragLeave() {
    dropZoneActive = false;
  }

  function handleFileInputChange(e: Event) {
    const input = e.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      handleFiles(input.files);
      input.value = ''; // сбрасываем для повторного выбора
    }
  }

  function handleFiles(files: FileList) {
    // Передаём файлы родителю через callback
    const fileArray = Array.from(files);
    onFilesSelected(fileArray);
  }

  let { onFilesSelected = (files: File[]) => {} }: { onFilesSelected?: (files: File[]) => void } =
    $props();
</script>

<div
  class="relative border-2 border-dashed rounded-xl p-4 text-center transition-all cursor-pointer {dropZoneActive
    ? 'border-brand-500 bg-brand-50'
    : 'border-slate-200 hover:border-brand-400 hover:bg-brand-50/50'}"
  ondrop={handleDrop}
  ondragover={handleDragOver}
  ondragleave={handleDragLeave}
  onclick={() => fileInput.click()}
  role="button"
  tabindex="0"
  aria-label="Зона для перетаскивания файлов"
>
  <div class="flex items-center justify-center gap-3">
    <Upload size={24} class="text-ink-tertiary" />
    <div class="text-left">
      <p class="text-sm font-medium text-ink-secondary">
        Перетащите файлы или кликните
      </p>
      <p class="text-xs text-ink-tertiary mt-0.5">Изображения и текстовые файлы</p>
    </div>
  </div>
  <input
    bind:this={fileInput}
    type="file"
    multiple
    class="hidden"
    onchange={handleFileInputChange}
    accept="image/*,.txt,.md,.py,.js,.html,.css,.json,.xml,.csv,.sql,.java,.cpp,.c,.h,.php,.rb,.go,.rs,.ts,.jsx,.tsx,.yaml,.yml,.svelte,.gd"
  />
</div>