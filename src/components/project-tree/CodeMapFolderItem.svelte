<script lang="ts">
  import { ChevronDown, ChevronRight, Folder } from "@lucide/svelte";
  import type { TreeNode } from "../../utils/projectTree";
  import CodeMapFolderItem from "./CodeMapFolderItem.svelte";

  interface Props {
    node: TreeNode;
    selectedPath: string;
    onSelect: (node: TreeNode) => void;
  }
  let { node, selectedPath, onSelect }: Props = $props();
  let isOpen = $state(true);

  function toggle(event: Event) {
    event.stopPropagation();
    isOpen = !isOpen;
  }

  function handleSelect(event: Event) {
    event.stopPropagation();
    onSelect(node);
  }
</script>

{#if node.type === "directory"}
  <div>
    <button
      type="button"
      onclick={handleSelect}
      class="flex w-full items-center gap-2 rounded px-2 py-1 text-[13px] transition-colors {node.path === selectedPath ? 'bg-[var(--accent-dim)] text-[var(--accent)]' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-lighter)] hover:text-[var(--text-primary)]'}"
    >
      <span
        role="button"
        tabindex="0"
        onclick={toggle}
        onkeydown={(e) => e.key === "Enter" && toggle(e)}
        class="flex shrink-0 items-center justify-center rounded p-0.5 transition-colors hover:bg-[var(--bg-lighter)] cursor-pointer"
      >
        {#if isOpen}
          <ChevronDown size={14} />
        {:else}
          <ChevronRight size={14} />
        {/if}
      </span>
      <Folder size={16} class="text-[var(--text-tertiary)]" />
      <span class="truncate">{node.name}</span>
    </button>

    {#if isOpen && node.children.length > 0}
      <div class="ml-4 border-l border-[var(--border)] pl-2">
        {#each node.children as child}
          {#if child.type === "directory"}
            <CodeMapFolderItem
              node={child}
              {selectedPath}
              {onSelect}
            />
          {/if}
        {/each}
      </div>
    {/if}
  </div>
{/if}