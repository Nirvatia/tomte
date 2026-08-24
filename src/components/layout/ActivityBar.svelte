<script lang="ts">
  import { FolderKanban, Tag } from "@lucide/svelte";
  import { isProjectManagerOpen, isTagManagerOpen } from "../../stores";
</script>

<div
  class="flex w-[52px] shrink-0 flex-col items-center gap-1 border-r border-[var(--border)] bg-[var(--bg-dark)] py-3"
>
  <button
    type="button"
    onclick={() => isProjectManagerOpen.set(true)}
    class="relative flex h-11 w-11 cursor-pointer items-center justify-center rounded transition-colors {$isProjectManagerOpen
      ? 'bg-[var(--accent-dim)] text-[var(--accent)]'
      : 'text-[var(--text-tertiary)] hover:bg-[var(--bg-light)] hover:text-[var(--text-primary)]'}"
    aria-label="Открыть менеджер проектов"
    title="Менеджер проектов"
  >
    {#if $isProjectManagerOpen}
      <div
        class="absolute left-0 top-2.5 bottom-2.5 w-[3px] rounded-r bg-[var(--accent)]"
      ></div>
    {/if}
    <FolderKanban size={22} />
  </button>

  <button
    type="button"
    onclick={() => isTagManagerOpen.set(true)}
    class="relative flex h-11 w-11 cursor-pointer items-center justify-center rounded transition-colors {$isTagManagerOpen
      ? 'bg-[var(--accent-dim)] text-[var(--accent)]'
      : 'text-[var(--text-tertiary)] hover:bg-[var(--bg-light)] hover:text-[var(--text-primary)]'}"
    aria-label="Открыть менеджер тегов"
    title="Теги"
  >
    {#if $isTagManagerOpen}
      <div
        class="absolute left-0 top-2.5 bottom-2.5 w-[3px] rounded-r bg-[var(--accent)]"
      ></div>
    {/if}
    <Tag size={22} />
  </button>
</div>
