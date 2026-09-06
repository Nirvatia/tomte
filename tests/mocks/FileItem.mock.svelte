<script lang="ts">
  let {
    file,
    allFiles = [],
    isSelected = false,
    onToggleSelect = () => {},
    onRemove = () => {},
    onPreview = () => {},
    onInsertPlaceholder = () => {},
  }: any = $props();
</script>

<div data-testid="file-item" data-selected={isSelected}>
  <span>{file.name}</span>

  <button
    type="button"
    aria-label={`Выбрать ${file.name}`}
    onclick={() => onToggleSelect(file.id)}
  ></button>

  <button
    type="button"
    aria-label={`Удалить ${file.name}`}
    onclick={() => onRemove(file.id)}
  ></button>

  <button
    type="button"
    aria-label={`Открыть превью ${file.name}`}
    onclick={() => onPreview(file)}
  ></button>

  <button
    type="button"
    aria-label={`Вставить плейсхолдер ${file.name}`}
    onclick={() => onInsertPlaceholder(file)}
  ></button>
</div>