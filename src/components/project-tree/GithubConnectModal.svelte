<script lang="ts">
  import { X, FolderGit, LoaderCircle } from "@lucide/svelte";

  import type { GithubRepoConfig } from "../../utils/github";
  import { fetchGithubTree, parseGithubUrl } from "../../utils/github";

  import { activeProject, selectedProjectFiles } from "../../stores";

  import { calculateStats } from "../../utils/projectTree";
  import {
    setGithubConfig,
    setProjectTreeSource,
  } from "../../utils/projectActions";

  interface Props {
    isOpen?: boolean;
    onClose?: () => void;
  }

  let { isOpen = false, onClose = () => {} }: Props = $props();

  let githubUrl = $state("");
  let githubBranch = $state("main");
  let githubToken = $state("");
  let isLoading = $state(false);
  let error = $state<string | null>(null);

  $effect(() => {
    if (isOpen) {
      const config = $activeProject?.githubConfig;
      if (config) {
        githubUrl = `https://github.com/${config.owner}/${config.repo}`;
        githubBranch = config.branch;
        githubToken = config.token || "";
      } else {
        githubUrl = "";
        githubBranch = "main";
        githubToken = "";
      }
      error = null;
    }
  });

  function handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      onClose();
    }
  }

  function handleBackdropKeydown(event: KeyboardEvent) {
    const target = event.target as HTMLElement | null;
    if (target && target.tagName === "INPUT") {
      return;
    }

    if (event.key === "Escape") {
      onClose();
    }
  }

  function handleWindowKeydown(event: KeyboardEvent) {
    if (event.key === "Escape" && isOpen) {
      onClose();
    }
  }

  function stopEventPropagation(event: Event) {
    event.stopPropagation();
  }

  async function handleConnect() {
    const parsed = parseGithubUrl(githubUrl);
    if (!parsed) {
      error = "Неверный URL репозитория. Пример: https://github.com/owner/repo";
      return;
    }

    error = null;
    isLoading = true;

    try {
      const config: GithubRepoConfig = {
        owner: parsed.owner,
        repo: parsed.repo,
        branch: githubBranch || "main",
        token: githubToken.trim() || undefined,
      };

      const nodes = await fetchGithubTree(config);
      const fileCount = calculateStats(nodes).totalFiles;
      selectedProjectFiles.set([]);

      const saved = await setProjectTreeSource({
        rootName: parsed.repo,
        nodes,
        fileCount,
      });

      if (!saved) {
        error =
          "Дерево не сохранено: превышен лимит проекта или операция была отменена.";
        return;
      }

      await setGithubConfig(config);
      onClose();
    } catch (err: any) {
      error = err.message || "Не удалось загрузить репозиторий";
      console.error(err);
    } finally {
      isLoading = false;
    }
  }
</script>

<svelte:window onkeydown={handleWindowKeydown} />

{#if isOpen}
  <div
    class="fixed inset-0 z-50 flex animate-fade-in items-center justify-center bg-black/60 p-4 backdrop-blur-[2px]"
    onclick={handleBackdropClick}
    onkeydown={handleBackdropKeydown}
    role="dialog"
    aria-modal="true"
    aria-label="Подключить GitHub"
    tabindex="-1"
  >
    <div
      class="w-full max-w-md rounded-xl border border-[var(--border-light)] bg-[var(--bg-medium)] p-6 shadow-[var(--shadow-lg)]"
      role="presentation"
      onclick={stopEventPropagation}
    >
      <div class="mb-4 flex items-center justify-between">
        <h3
          class="flex items-center gap-2 text-lg font-bold text-[var(--text-primary)]"
        >
          <FolderGit size={20} class="text-[var(--accent)]" />
          Подключить GitHub
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

      {#if error}
        <div
          class="mb-4 rounded-md border border-[var(--error)]/40 bg-[var(--error)]/10 px-3 py-2 text-xs text-[var(--error)]"
        >
          {error}
        </div>
      {/if}

      <div class="space-y-4">
        <div>
          <label
            for="github-url"
            class="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.8px] text-[var(--text-tertiary)]"
            >URL репозитория</label
          >
          <input
            id="github-url"
            bind:value={githubUrl}
            placeholder="https://github.com/owner/repo"
            class="w-full rounded-md border border-[var(--border)] bg-[var(--bg-darkest)] px-3 py-2 text-sm text-[var(--text-primary)] transition-all placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent)]/60 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/15"
          />
        </div>

        <div>
          <label
            for="github-branch"
            class="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.8px] text-[var(--text-tertiary)]"
            >Ветка (branch)</label
          >
          <input
            id="github-branch"
            bind:value={githubBranch}
            placeholder="main"
            class="w-full rounded-md border border-[var(--border)] bg-[var(--bg-darkest)] px-3 py-2 text-sm text-[var(--text-primary)] transition-all placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent)]/60 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/15"
          />
        </div>

        <div>
          <label
            for="github-token"
            class="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.8px] text-[var(--text-tertiary)]"
          >
            Personal Access Token
            <span
              class="normal-case tracking-normal text-[var(--text-tertiary)]/70"
              >(опционально, для приватных)</span
            >
          </label>
          <input
            id="github-token"
            bind:value={githubToken}
            type="password"
            placeholder="ghp_xxxxxxxxxxxx"
            class="w-full rounded-md border border-[var(--border)] bg-[var(--bg-darkest)] px-3 py-2 font-mono text-sm text-[var(--text-primary)] transition-all placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent)]/60 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/15"
          />
        </div>

        <button
          type="button"
          onclick={handleConnect}
          disabled={isLoading || !githubUrl}
          class="flex w-full items-center justify-center gap-2 rounded-md bg-[var(--accent)] py-2.5 text-xs font-semibold text-[var(--bg-darkest)] transition-colors hover:bg-[var(--accent-hover)] disabled:opacity-50"
        >
          {#if isLoading}
            <LoaderCircle size={15} class="animate-spin" />
            <span>Загрузка...</span>
          {:else}
            <span>Подключить</span>
          {/if}
        </button>
      </div>
    </div>
  </div>
{/if}
