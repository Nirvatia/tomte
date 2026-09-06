<script lang="ts">
  import { LoaderCircle } from "@lucide/svelte";
  import type { AttachedFile } from "../../types";
  import type { TreeNode } from "../../utils/projectTree";
  import {
    activeProject,
    attachedFiles,
    editorHtml,
    promptFiles,
    projectTreeNodes,
    selectedFileIds,
    selectedProjectFiles,
  } from "../../stores";
  import { pluralize } from "../../utils";
  import {
    estimateAttachmentTokens,
    estimateHtmlTokens,
    getCachedTreeTokens,
    loadTreeFileTokens,
    resetTreeTokenCache,
  } from "../../utils/tokens";

  const RECOMPUTE_DEBOUNCE_MS = 400;
  const TREE_LOAD_CONCURRENCY = 3;

  let tokenEstimate = $state(0);
  let isTreeLoading = $state(false);
  let computationId = 0;

  // Любая замена дерева (подключение папки, обновление/восстановление
  // GitHub, смена проекта, очистка) инвалидирует кэш токенов:
  // содержимое файлов могло измениться.
  $effect(() => {
    void $projectTreeNodes;
    resetTreeTokenCache();
  });

  // Пересчёт с дебаунсом: не на каждый клик/нажатие клавиши,
  // а когда пользователь «успокоился».
  $effect(() => {
    const html = $editorHtml;
    const files = $attachedFiles;
    const selectedIds = $selectedFileIds;
    const treeNodes = $projectTreeNodes;
    const selectedPaths = $selectedProjectFiles;

    const timer = setTimeout(() => {
      void recompute(html, files, selectedIds, treeNodes, selectedPaths);
    }, RECOMPUTE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  });

  function collectSelectedTreeFiles(
    nodes: TreeNode[],
    selectedPaths: string[],
  ): TreeNode[] {
    const selectedSet = new Set(selectedPaths);
    const result: TreeNode[] = [];
    function walk(items: TreeNode[]): void {
      for (const item of items) {
        if (item.type === "file") {
          if (selectedSet.has(item.path)) {
            result.push(item);
          }
        } else {
          walk(item.children);
        }
      }
    }
    walk(nodes);
    return result;
  }

  // Мгновенная сумма по уже известным данным:
  // промпт + вложения + закэшированные файлы дерева.
  function computeKnownTotal(
    html: string,
    files: AttachedFile[],
    selectedIds: Set<string>,
    treeNodes: TreeNode[],
    selectedPaths: string[],
  ): number {
    let total = estimateHtmlTokens(html);
    for (const file of files) {
      if (selectedIds.has(file.id)) {
        total += estimateAttachmentTokens(file);
      }
    }
    for (const node of collectSelectedTreeFiles(treeNodes, selectedPaths)) {
      const cached = getCachedTreeTokens(node.path);
      if (cached !== undefined) {
        total += cached;
      }
    }
    return total;
  }

  async function recompute(
    html: string,
    files: AttachedFile[],
    selectedIds: Set<string>,
    treeNodes: TreeNode[],
    selectedPaths: string[],
  ): Promise<void> {
    const myId = ++computationId;

    // Фаза 1: мгновенная оценка из того, что уже известно
    tokenEstimate = computeKnownTotal(
      html,
      files,
      selectedIds,
      treeNodes,
      selectedPaths,
    );

    const uncached = collectSelectedTreeFiles(
      treeNodes,
      selectedPaths,
    ).filter((node) => getCachedTreeTokens(node.path) === undefined);
    if (uncached.length === 0) {
      isTreeLoading = false;
      return;
    }

    // Фаза 2: фоновая догрузка незакэшированных файлов дерева.
    // Ограниченная параллельность, чтобы не спамить GitHub API.
    isTreeLoading = true;
    let index = 0;
    const worker = async (): Promise<void> => {
      while (index < uncached.length) {
        if (myId !== computationId) return;
        const node = uncached[index];
        index += 1;
        await loadTreeFileTokens(node);
        if (myId !== computationId) return;
        tokenEstimate = computeKnownTotal(
          html,
          files,
          selectedIds,
          treeNodes,
          selectedPaths,
        );
      }
    };
    const workers = Array.from(
      { length: Math.min(TREE_LOAD_CONCURRENCY, uncached.length) },
      () => worker(),
    );
    await Promise.all(workers);

    if (myId !== computationId) return;
    isTreeLoading = false;
    tokenEstimate = computeKnownTotal(
      html,
      files,
      selectedIds,
      treeNodes,
      selectedPaths,
    );
  }
</script>

<div
  class="flex h-[28px] shrink-0 items-center border-t border-[var(--border)] bg-[var(--bg-dark)] px-4 text-[12px] text-[var(--text-secondary)]"
>
  <span
    class="flex max-w-[300px] items-center gap-1.5 truncate font-medium text-[13px] text-[var(--text-secondary)]"
  >
    <span class="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]"></span>
    {$activeProject?.name ?? "—"}
  </span>
  <div class="ml-auto flex items-center gap-3">
    <span>
      {$promptFiles.length}
      {pluralize($promptFiles.length, "промпт", "промпта", "промптов")}
    </span>
    <span>·</span>
    <span>
      {$attachedFiles.length}
      {pluralize($attachedFiles.length, "вложение", "вложения", "вложений")}
    </span>
    <span>·</span>
    <span
      class="flex items-center gap-1.5 font-mono tabular-nums"
      title="Оценка: текст активного промпта + выделенные вложения и файлы дерева. Изображения не учитываются."
    >
      {#if isTreeLoading}
        <LoaderCircle
          size={11}
          class="animate-spin text-[var(--text-tertiary)]"
        />
      {/if}
      ≈ {tokenEstimate.toLocaleString("ru-RU")}
      {pluralize(tokenEstimate, "токен", "токена", "токенов")}
    </span>
  </div>
</div>