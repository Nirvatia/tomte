<script lang="ts">
  import { t } from "$lib/i18n";
  import { Funnel } from "@lucide/svelte";

  import Checkbox from "../ui/Checkbox.svelte";
  import { activeProject } from "../../stores";
  import { DEFAULT_TREE_FILTER, type TreeFilterSettings } from "../../types";
  import { setTreeFilter } from "../../utils/projectActions";

  /**
   * Фильтр выбора файлов дерева (этап 10.6): .gitignore, пресеты и свои
   * правила. Кнопка-воронка и поповер; вынесено из ProjectTreeSection
   * (этап 15.2). Закрывается повторным нажатием, кликом мимо и Escape.
   */

  const PRESETS = [
    ["only-src", "treeFilter.presetOnlySrc"],
    ["no-tests", "treeFilter.presetNoTests"],
    ["code-only", "treeFilter.presetCodeOnly"],
  ] as const;

  const treeFilter = $derived(
    $activeProject?.treeFilter ?? DEFAULT_TREE_FILTER,
  );
  const filterActive = $derived(
    treeFilter.presets.length > 0 || treeFilter.custom.length > 0,
  );

  let isOpen = $state(false);
  let container = $state<HTMLDivElement | null>(null);
  let trigger = $state<HTMLButtonElement | null>(null);
  /** Черновик своих правил: в проект уходит по change (потеря фокуса). */
  let customDraft = $state("");

  function toggle() {
    if (!isOpen) customDraft = treeFilter.custom.join("\n");
    isOpen = !isOpen;
  }

  function close() {
    commitCustom();
    isOpen = false;
  }

  async function patchTreeFilter(patch: Partial<TreeFilterSettings>) {
    await setTreeFilter({ ...treeFilter, ...patch });
  }

  function togglePreset(id: string) {
    const presets = treeFilter.presets.includes(id)
      ? treeFilter.presets.filter((p) => p !== id)
      : [...treeFilter.presets, id];
    void patchTreeFilter({ presets });
  }

  function commitCustom() {
    const custom = customDraft
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    if (custom.join("\n") !== treeFilter.custom.join("\n")) {
      void patchTreeFilter({ custom });
    }
  }

  function handlePointerDown(event: PointerEvent) {
    if (isOpen && container && !container.contains(event.target as Node)) {
      close();
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (isOpen && event.key === "Escape" && !event.defaultPrevented) {
      event.preventDefault();
      close();
      trigger?.focus();
    }
  }
</script>

<svelte:window onpointerdown={handlePointerDown} onkeydown={handleKeydown} />

<div bind:this={container} class="relative">
  <button
    bind:this={trigger}
    type="button"
    onclick={toggle}
    aria-expanded={isOpen}
    aria-label={$t("treeFilter.button")}
    title={$t("treeFilter.button")}
    class="flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors {filterActive
      ? 'bg-[var(--accent-dim)] text-[var(--accent)]'
      : 'text-[var(--text-tertiary)] hover:bg-[var(--bg-light)] hover:text-[var(--text-primary)]'}"
  >
    <Funnel size={14} />
  </button>
  {#if isOpen}
    <div
      class="menu-panel absolute right-0 top-full z-[var(--layer-dropdown)] mt-1 w-72 space-y-3 p-3 animate-fade-in"
      role="dialog"
      aria-label={$t("treeFilter.title")}
    >
      <p class="text-caption leading-snug text-[var(--text-tertiary)]">
        {$t("treeFilter.hint")}
      </p>
      <Checkbox
        checked={treeFilter.useGitignore}
        onToggle={() =>
          void patchTreeFilter({ useGitignore: !treeFilter.useGitignore })}
      >
        <span class="text-label text-[var(--text-secondary)]">
          {$t("treeFilter.gitignore")}
        </span>
      </Checkbox>
      <div class="space-y-1.5">
        {#each PRESETS as [id, labelKey] (id)}
          <Checkbox
            checked={treeFilter.presets.includes(id)}
            onToggle={() => togglePreset(id)}
          >
            <span class="text-label text-[var(--text-secondary)]">
              {$t(labelKey)}
            </span>
          </Checkbox>
        {/each}
      </div>
      <label class="block">
        <span class="mb-1 block text-caption text-[var(--text-tertiary)]">
          {$t("treeFilter.customLabel")}
        </span>
        <textarea
          rows="3"
          bind:value={customDraft}
          onblur={commitCustom}
          placeholder={$t("treeFilter.customPlaceholder")}
          class="input h-auto w-full resize-none px-2 py-1.5 font-mono text-label"
        ></textarea>
      </label>
    </div>
  {/if}
</div>
