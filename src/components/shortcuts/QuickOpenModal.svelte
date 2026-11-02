<script lang="ts">
  import { t } from "$lib/i18n";
  import { FileText } from "@lucide/svelte";

  import ModalShell from "../ui/ModalShell.svelte";
  import { autofocus } from "$lib/actions/autofocus";
  import { activeFileId, isQuickOpenOpen, promptFiles } from "../../stores";
  import { pinPromptFile } from "../../utils/projectActions";

  let query = $state("");
  let highlighted = $state(0);

  /** Сначала совпадения с начала имени, потом остальные; регистр не важен. */
  const results = $derived.by(() => {
    const q = query.trim().toLowerCase();
    if (!q) return $promptFiles;
    const starts = $promptFiles.filter((f) =>
      f.name.toLowerCase().startsWith(q),
    );
    const contains = $promptFiles.filter(
      (f) =>
        !f.name.toLowerCase().startsWith(q) && f.name.toLowerCase().includes(q),
    );
    return [...starts, ...contains];
  });

  $effect(() => {
    void query;
    highlighted = 0;
  });

  function close() {
    isQuickOpenOpen.set(false);
    query = "";
  }

  function open(fileId: string) {
    close();
    void pinPromptFile(fileId);
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      const count = results.length || 1;
      highlighted = (highlighted + step + count) % count;
    } else if (event.key === "Enter") {
      event.preventDefault();
      const file = results[highlighted];
      if (file) open(file.id);
    }
  }
</script>

{#if $isQuickOpenOpen}
  <ModalShell label={$t("hotkeys.quickOpen")} onClose={close} placement="top">
    <input
      use:autofocus
      bind:value={query}
      onkeydown={handleKeydown}
      type="text"
      placeholder={$t("quickOpen.placeholder")}
      aria-label={$t("quickOpen.input")}
      aria-controls="quick-open-results"
      aria-activedescendant={results[highlighted]
        ? `quick-open-${results[highlighted].id}`
        : undefined}
      class="w-full border-b border-[var(--border)] bg-transparent px-4 py-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none"
    />
    <ul
      id="quick-open-results"
      role="listbox"
      class="max-h-80 overflow-y-auto py-1"
    >
      {#each results as file, index (file.id)}
        <li
          id="quick-open-{file.id}"
          role="option"
          aria-selected={index === highlighted}
          class="flex cursor-pointer items-center gap-2 px-4 py-2 text-[13px] {index ===
          highlighted
            ? 'bg-[var(--accent-dim)] text-[var(--text-primary)]'
            : 'text-[var(--text-secondary)]'}"
          onclick={() => open(file.id)}
          onkeydown={() => {}}
          onmousemove={() => (highlighted = index)}
        >
          <FileText size={14} class="shrink-0" />
          <span class="truncate">{file.name}</span>
          {#if file.id === $activeFileId}
            <span class="ml-auto text-[11px] text-[var(--text-tertiary)]"
              >{$t("quickOpen.open")}</span
            >
          {/if}
        </li>
      {:else}
        <li class="px-4 py-3 text-[13px] text-[var(--text-tertiary)]">
          {$t("common.nothingFound")}
        </li>
      {/each}
    </ul>
  </ModalShell>
{/if}
