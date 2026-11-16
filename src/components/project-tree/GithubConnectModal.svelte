<script lang="ts">
  import { logError } from "$lib/log";
  import ModalShell from "../ui/ModalShell.svelte";
  import { t } from "$lib/i18n";
  import { X, FolderGit, LoaderCircle } from "@lucide/svelte";

  import type { GithubRepoConfig } from "../../utils/github";
  import { fetchGithubTree, parseGithubUrl } from "../../utils/github";

  import { activeProject, selectedProjectFiles } from "../../stores";

  import { calculateStats } from "../../utils/projectTree";
  import { getErrorMessage } from "../../utils";
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

  async function handleConnect() {
    const parsed = parseGithubUrl(githubUrl);
    if (!parsed) {
      error = $t("github.badUrl");
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
        error = $t("github.notSaved");
        return;
      }

      await setGithubConfig(config);
      onClose();
    } catch (err) {
      error = getErrorMessage(err, $t("tree.errors.loadRepo"));
      logError("Unexpected error", err);
    } finally {
      isLoading = false;
    }
  }
</script>

{#if isOpen}
  <ModalShell
    label={$t("tree.connectGithub")}
    {onClose}
    width="max-w-md"
    panelClass="p-6"
  >
    <div class="mb-4 flex items-center justify-between">
      <h3
        class="flex items-center gap-2 text-lg font-bold text-[var(--text-primary)]"
      >
        <FolderGit size={20} class="text-[var(--accent)]" />
        {$t("tree.connectGithub")}
      </h3>
      <button
        type="button"
        onclick={onClose}
        class="icon-btn"
        aria-label={$t("common.close")}
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
          class="mb-1.5 block text-caption font-semibold uppercase tracking-[0.8px] text-[var(--text-tertiary)]"
          >{$t("github.url")}</label
        >
        <input
          id="github-url"
          bind:value={githubUrl}
          placeholder="https://github.com/owner/repo"
          class="input w-full px-3"
        />
      </div>

      <div>
        <label
          for="github-branch"
          class="mb-1.5 block text-caption font-semibold uppercase tracking-[0.8px] text-[var(--text-tertiary)]"
          >{$t("github.branch")}</label
        >
        <input
          id="github-branch"
          bind:value={githubBranch}
          placeholder="main"
          class="input w-full px-3"
        />
      </div>

      <div>
        <label
          for="github-token"
          class="mb-1.5 block text-caption font-semibold uppercase tracking-[0.8px] text-[var(--text-tertiary)]"
        >
          Personal Access Token
          <span
            class="normal-case tracking-normal text-[var(--text-tertiary)]/70"
            >{$t("github.tokenOptional")}</span
          >
        </label>
        <input
          id="github-token"
          bind:value={githubToken}
          type="password"
          placeholder="ghp_xxxxxxxxxxxx"
          class="input w-full px-3 font-mono"
        />
      </div>

      <button
        type="button"
        onclick={handleConnect}
        disabled={isLoading || !githubUrl}
        class="btn btn-primary btn-md w-full"
      >
        {#if isLoading}
          <LoaderCircle size={15} class="animate-spin" />
          <span>{$t("common.loading")}</span>
        {:else}
          <span>{$t("github.connect")}</span>
        {/if}
      </button>
    </div>
  </ModalShell>
{/if}
