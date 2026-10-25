<script lang="ts">
  import { X, Copy, Check, Folder, LoaderCircle } from "@lucide/svelte";
  import { projectTreeNodes, projectTreeRootName } from "../../stores";
  import { generateCodeMap } from "../../utils/codeMap";
  import type { TreeNode } from "../../utils/projectTree";
  import CodeMapFolderItem from "./CodeMapFolderItem.svelte";

  interface Props {
    isOpen?: boolean;
    onClose?: () => void;
  }
  let { isOpen = false, onClose = () => {} }: Props = $props();

  let selectedNode = $state<TreeNode | null>(null);
  let generatedMap = $state("");
  let copied = $state(false);
  let isGenerating = $state(false);

  $effect(() => {
    if (isOpen) {
      if ($projectTreeNodes.length > 0) {
        selectedNode = {
          name: $projectTreeRootName || "root",
          path: "root",
          type: "directory",
          children: $projectTreeNodes,
        };
      } else {
        selectedNode = null;
      }
      generatedMap = "";
      copied = false;
    }
  });

  function handleSelect(node: TreeNode) {
    selectedNode = node;
    generatedMap = "";
    copied = false;
  }

  async function handleGenerate() {
    if (!selectedNode) return;
    isGenerating = true;
    try {
      generatedMap = await generateCodeMap(selectedNode);
      copied = false;
    } catch (err) {
      console.error(err);
      generatedMap = "Error generating code map";
    } finally {
      isGenerating = false;
    }
  }

  async function handleCopy() {
    if (!generatedMap) return;
    try {
      await navigator.clipboard.writeText(generatedMap);
      copied = true;
      setTimeout(() => (copied = false), 2000);
    } catch (err) {
      console.error("Failed to copy", err);
    }
  }

  function handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) onClose();
  }
</script>

{#if isOpen}
  <div
    class="fixed inset-0 z-50 flex animate-fade-in items-center justify-center bg-black/60 p-4 backdrop-blur-[2px]"
    onclick={handleBackdropClick}
    role="dialog"
    aria-modal="true"
    aria-label="Генератор карты кода"
    tabindex="-1"
  >
    <div class="flex h-[80vh] w-full max-w-5xl flex-col rounded-xl border border-[var(--border-light)] bg-[var(--bg-medium)] shadow-[var(--shadow-lg)]">
      <div class="flex shrink-0 items-center justify-between border-b border-[var(--border)] px-6 py-4">
        <h3 class="flex items-center gap-2 text-lg font-bold text-[var(--text-primary)]">
          <Folder size={20} class="text-[var(--accent)]" />
          Генератор карты кода (Tree-sitter)
        </h3>
        <button
          type="button"
          onclick={onClose}
          class="rounded p-1 text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-lighter)] hover:text-[var(--text-primary)]"
          aria-label="Закрыть"
        >
          <X size={18} />
        </button>
      </div>

      <div class="flex flex-1 overflow-hidden">
        <div class="flex w-1/3 flex-col border-r border-[var(--border)]">
          <div class="border-b border-[var(--border)] px-4 py-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
            Выберите папку
          </div>
          <div class="flex-1 overflow-y-auto p-2">
            {#if $projectTreeNodes.length === 0}
              <div class="p-4 text-center text-sm text-[var(--text-tertiary)]">
                Дерево проекта пусто.
              </div>
            {:else}
              {#each $projectTreeNodes as node}
                {#if node.type === "directory"}
                  <CodeMapFolderItem
                    {node}
                    selectedPath={selectedNode?.path || ""}
                    onSelect={handleSelect}
                  />
                {/if}
              {/each}
            {/if}
          </div>
        </div>

        <div class="flex w-2/3 flex-col bg-[var(--bg-darkest)]">
          <div class="flex items-center justify-between border-b border-[var(--border)] px-4 py-2">
            <span class="text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
              {selectedNode ? `Карта для: ${selectedNode.name}` : "Результат"}
            </span>
            <div class="flex gap-2">
              <button
                type="button"
                onclick={handleGenerate}
                disabled={!selectedNode || isGenerating}
                class="flex items-center gap-1 rounded px-3 py-1 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-lighter)] hover:text-[var(--text-primary)] disabled:opacity-40"
              >
                {#if isGenerating}
                  <LoaderCircle size={14} class="animate-spin" />
                  <span>Генерация...</span>
                {:else}
                  <span>Сгенерировать</span>
                {/if}
              </button>
              {#if generatedMap}
                <button
                  type="button"
                  onclick={handleCopy}
                  class="flex items-center gap-1 rounded px-3 py-1 text-xs font-medium transition-colors {copied ? 'text-[var(--success)]' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-lighter)] hover:text-[var(--text-primary)]'}"
                >
                  {#if copied}
                    <Check size={14} />
                    <span>Скопировано</span>
                  {:else}
                    <Copy size={14} />
                    <span>Копировать</span>
                  {/if}
                </button>
              {/if}
            </div>
          </div>
          <div class="flex-1 overflow-y-auto p-4">
            {#if generatedMap}
              <pre class="font-mono text-xs text-[var(--text-primary)] whitespace-pre-wrap">{generatedMap}</pre>
            {:else}
              <div class="flex h-full items-center justify-center text-sm text-[var(--text-tertiary)]">
                {selectedNode ? "Нажмите 'Сгенерировать'" : "Выберите папку слева"}
              </div>
            {/if}
          </div>
        </div>
      </div>
    </div>
  </div>
{/if}