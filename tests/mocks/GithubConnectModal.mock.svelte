<script lang="ts">
  let { isOpen = false, onClose = () => {} }: any = $props();
</script>

{#if isOpen}
  <div role="dialog" aria-label="GithubConnectModal">
    GithubConnectModal

    <button type="button" onclick={onClose}>
      Закрыть
    </button>
  </div>
{/if}