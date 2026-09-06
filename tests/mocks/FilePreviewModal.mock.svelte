<script lang="ts">
  let { file = null, onClose = () => {} }: any = $props();
</script>

{#if file}
  <div role="dialog" aria-label={`Превью ${file.name}`}>
    {file.name}

    <button type="button" onclick={onClose}>
      Закрыть
    </button>
  </div>
{/if}