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
  import { menu } from "$lib/actions/menu";
  import {
    CUSTOM_MODEL_ID,
    MODEL_PRESETS,
    MODELS_CHECKED_AT,
  } from "$lib/models";
  import {
    formatTokensShort,
    tokenLimit,
    tokenLimitSetting,
    usageLevel,
  } from "$lib/tokenLimit";
  import {
    estimateAttachmentTokens,
    estimateHtmlTokens,
    getCachedTreeTokens,
    loadTreeFileTokens,
    resetTreeTokenCache,
  } from "../../utils/tokens";

  const RECOMPUTE_DEBOUNCE_MS = 400;
  const TREE_LOAD_CONCURRENCY = 3;

  interface TokenBreakdown {
    prompt: number;
    attachments: number;
    tree: number;
    total: number;
  }
  let breakdown = $state<TokenBreakdown>({
    prompt: 0,
    attachments: 0,
    tree: 0,
    total: 0,
  });
  const tokenEstimate = $derived(breakdown.total);
  let isPanelOpen = $state(false);
  let panelButton = $state<HTMLButtonElement | null>(null);

  const level = $derived(usageLevel(tokenEstimate, $tokenLimit.tokens));
  const percent = $derived(
    $tokenLimit.tokens > 0
      ? Math.round((tokenEstimate / $tokenLimit.tokens) * 100)
      : 0,
  );
  const LEVEL_COLOR = {
    ok: "text-[var(--text-secondary)]",
    warn: "text-[var(--warning)]",
    over: "text-[var(--error)]",
  } as const;
  const LEVEL_BAR = {
    ok: "bg-[var(--accent)]",
    warn: "bg-[var(--warning)]",
    over: "bg-[var(--error)]",
  } as const;

  let panelContainer = $state<HTMLDivElement | null>(null);

  function handlePointerDown(event: PointerEvent) {
    if (
      isPanelOpen &&
      panelContainer &&
      !panelContainer.contains(event.target as Node)
    ) {
      isPanelOpen = false;
    }
  }

  function setModel(modelId: string) {
    tokenLimitSetting.update((s) => ({ ...s, modelId }));
  }

  function setCustomTokens(value: string) {
    const tokens = Math.round(Number(value.replace(/\s/g, "")));
    if (Number.isFinite(tokens) && tokens > 0) {
      tokenLimitSetting.update((s) => ({ ...s, customTokens: tokens }));
    }
  }
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

  // Мгновенная оценка по уже известным данным, по частям:
  // промпт, выделенные вложения, закэшированные файлы дерева.
  function computeKnownTotal(
    html: string,
    files: AttachedFile[],
    selectedIds: Set<string>,
    treeNodes: TreeNode[],
    selectedPaths: string[],
  ): TokenBreakdown {
    const prompt = estimateHtmlTokens(html);
    let attachments = 0;
    for (const file of files) {
      if (selectedIds.has(file.id)) {
        attachments += estimateAttachmentTokens(file);
      }
    }
    let tree = 0;
    for (const node of collectSelectedTreeFiles(treeNodes, selectedPaths)) {
      tree += getCachedTreeTokens(node.path) ?? 0;
    }
    return { prompt, attachments, tree, total: prompt + attachments + tree };
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
    breakdown = computeKnownTotal(
      html,
      files,
      selectedIds,
      treeNodes,
      selectedPaths,
    );

    const uncached = collectSelectedTreeFiles(treeNodes, selectedPaths).filter(
      (node) => getCachedTreeTokens(node.path) === undefined,
    );
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
        breakdown = computeKnownTotal(
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
    breakdown = computeKnownTotal(
      html,
      files,
      selectedIds,
      treeNodes,
      selectedPaths,
    );
  }
</script>

<svelte:window onpointerdown={handlePointerDown} />

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
    <div class="relative" bind:this={panelContainer}>
      <button
        bind:this={panelButton}
        type="button"
        onclick={() => (isPanelOpen = !isPanelOpen)}
        aria-haspopup="dialog"
        aria-expanded={isPanelOpen}
        class="flex items-center gap-1.5 rounded px-1.5 font-mono tabular-nums hover:bg-[var(--bg-light)] {LEVEL_COLOR[
          level
        ]}"
        title="Оценка токенов: текст активного промпта + выделенные вложения и файлы дерева. Нажмите, чтобы увидеть разбивку и выбрать модель."
      >
        {#if isTreeLoading}
          <LoaderCircle
            size={11}
            class="animate-spin text-[var(--text-tertiary)]"
          />
        {/if}
        ≈ {tokenEstimate.toLocaleString("ru-RU")} / {formatTokensShort(
          $tokenLimit.tokens,
        )}
        {pluralize(tokenEstimate, "токен", "токена", "токенов")}
        <span class="text-[var(--text-tertiary)]">· {percent}%</span>
      </button>

      {#if isPanelOpen}
        <div
          use:menu={{
            onClose: () => (isPanelOpen = false),
            returnFocus: panelButton,
          }}
          role="dialog"
          aria-label="Токены и лимит модели"
          tabindex="-1"
          class="absolute right-0 bottom-full z-50 mb-2 w-72 animate-fade-in rounded-[6px] border border-[var(--border-light)] bg-[var(--bg-medium)] p-3 text-[12px] shadow-[var(--shadow-md)]"
        >
          <dl class="space-y-1 font-mono tabular-nums">
            {#each [{ label: "Промпт", value: breakdown.prompt }, { label: "Вложения", value: breakdown.attachments }, { label: "Дерево проекта", value: breakdown.tree }] as row (row.label)}
              <div class="flex justify-between gap-3">
                <dt class="font-sans text-[var(--text-secondary)]">
                  {row.label}
                </dt>
                <dd>{row.value.toLocaleString("ru-RU")}</dd>
              </div>
            {/each}
            <div
              class="flex justify-between gap-3 border-t border-[var(--border)] pt-1 font-semibold"
            >
              <dt class="font-sans">Всего</dt>
              <dd class={LEVEL_COLOR[level]}>
                {tokenEstimate.toLocaleString("ru-RU")}
              </dd>
            </div>
          </dl>

          <div
            class="mt-2 h-1.5 overflow-hidden rounded bg-[var(--bg-lighter)]"
            role="meter"
            aria-label="Заполнение контекста"
            aria-valuemin={0}
            aria-valuemax={$tokenLimit.tokens}
            aria-valuenow={tokenEstimate}
          >
            <div
              class="h-full {LEVEL_BAR[level]}"
              style="width: {Math.min(percent, 100)}%"
            ></div>
          </div>
          {#if level === "over"}
            <p class="mt-1.5 text-[var(--error)]">
              Промпт больше контекста модели на {(
                tokenEstimate - $tokenLimit.tokens
              ).toLocaleString("ru-RU")}.
            </p>
          {/if}

          <label
            class="mt-3 block text-[var(--text-secondary)]"
            for="token-model">Модель</label
          >
          <select
            id="token-model"
            value={$tokenLimitSetting.modelId}
            onchange={(event) => setModel(event.currentTarget.value)}
            class="mt-1 w-full rounded border border-[var(--border)] bg-[var(--bg-darkest)] px-2 py-1 text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
          >
            {#each MODEL_PRESETS as model (model.id)}
              <option value={model.id}>
                {model.label} — {formatTokensShort(model.contextTokens)}
              </option>
            {/each}
            <option value={CUSTOM_MODEL_ID}>Свой лимит</option>
          </select>

          {#if $tokenLimitSetting.modelId === CUSTOM_MODEL_ID}
            <label
              class="mt-2 block text-[var(--text-secondary)]"
              for="token-custom"
            >
              Лимит, токенов
            </label>
            <input
              id="token-custom"
              type="number"
              min="1"
              step="1000"
              value={$tokenLimitSetting.customTokens}
              onchange={(event) => setCustomTokens(event.currentTarget.value)}
              class="mt-1 w-full rounded border border-[var(--border)] bg-[var(--bg-darkest)] px-2 py-1 font-mono text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
            />
          {/if}

          <p class="mt-2 text-[11px] leading-snug text-[var(--text-tertiary)]">
            Оценка приблизительная: считается по символам, без токенайзера
            модели. Изображения не учитываются. Лимиты моделей сверены в {MODELS_CHECKED_AT},
            они меняются — уточняйте у провайдера.
          </p>
        </div>
      {/if}
    </div>
  </div>
</div>
