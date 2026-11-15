<script lang="ts">
  import { t } from "$lib/i18n";
  import { FolderOutput, LoaderCircle } from "@lucide/svelte";
  import { onMount } from "svelte";

  import ModalShell from "../ui/ModalShell.svelte";
  import Checkbox from "../ui/Checkbox.svelte";

  import { notifyError, notifyInfo } from "$lib/notify";
  import { getErrorMessage } from "../../utils";
  import {
    pickWritableFolder,
    planFolderWrite,
    writeFolderFile,
    type PlanInput,
    type WritePlanItem,
  } from "../../utils/fileWriter";

  /**
   * Этап 10.5. Запись извлечённых файлов в выбранную папку:
   * сначала план (новые/изменённые с размером правок), потом запись.
   */
  interface Props {
    files: PlanInput[];
    onClose: () => void;
  }

  let { files, onClose }: Props = $props();

  let folderName = $state("");
  let plan = $state<WritePlanItem[]>([]);
  let unchecked = $state<Set<string>>(new Set());
  let isWriting = $state(false);
  /** Пути, которые не записались, с причиной. */
  let failures = $state<{ path: string; reason: string }[]>([]);

  const writableItems = $derived(plan.filter((item) => item.status !== "same"));
  const selectedPaths = $derived(
    new Set(
      writableItems.map((item) => item.path).filter((p) => !unchecked.has(p)),
    ),
  );

  onMount(() => {
    void (async () => {
      let dir: FileSystemDirectoryHandle | null = null;
      try {
        dir = await pickWritableFolder();
      } catch (error) {
        notifyError(getErrorMessage(error, $t("extractor.applyPickError")));
        onClose();
        return;
      }
      if (!dir) {
        onClose();
        return;
      }
      folderName = dir.name;
      plan = await planFolderWrite(dir, files);
      folderHandle = dir;
    })();
  });

  let folderHandle: FileSystemDirectoryHandle | null = null;

  function toggle(path: string) {
    unchecked = new Set(
      selectedPaths.has(path)
        ? [...unchecked, path]
        : [...unchecked].filter((p) => p !== path),
    );
  }

  async function handleWrite() {
    if (!folderHandle || isWriting) return;
    isWriting = true;
    failures = [];
    let written = 0;
    for (const item of plan) {
      if (!selectedPaths.has(item.path)) continue;
      try {
        await writeFolderFile(folderHandle, item.path, item.content);
        written += 1;
      } catch (error) {
        failures = [
          ...failures,
          {
            path: item.path,
            reason: getErrorMessage(error, $t("extractor.applyWriteError")),
          },
        ];
      }
    }
    isWriting = false;
    if (written > 0) {
      notifyInfo($t("extractor.applyDone", { count: written }));
    }
    if (failures.length === 0) {
      onClose();
    }
  }
</script>

<ModalShell
  label={$t("extractor.applyTitle")}
  onClose={isWriting ? () => {} : onClose}
  width="max-w-2xl"
>
  <div
    class="flex items-center justify-between border-b border-[var(--border)] px-6 py-4"
  >
    <h2
      class="flex items-center gap-2 text-lg font-bold text-[var(--text-primary)]"
    >
      <FolderOutput size={18} class="text-[var(--accent)]" />
      {$t("extractor.applyTitle")}
    </h2>
    <span class="font-mono text-[11px] text-[var(--text-tertiary)]">
      {folderName ? $t("extractor.applyFolder", { name: folderName }) : ""}
    </span>
  </div>

  {#if plan.length === 0}
    <div
      class="flex items-center justify-center gap-2 px-6 py-10 text-sm text-[var(--text-tertiary)]"
    >
      <LoaderCircle size={16} class="animate-spin" />
    </div>
  {:else}
    <ul class="max-h-[50vh] overflow-y-auto py-2">
      {#each plan as item (item.path)}
        <li class="flex items-center gap-3 px-6 py-1.5">
          {#if item.status === "same"}
            <span class="w-4"></span>
          {:else}
            <Checkbox
              checked={selectedPaths.has(item.path)}
              onToggle={() => toggle(item.path)}
              ariaLabel={item.path}
            />
          {/if}
          <span
            class="min-w-0 flex-1 truncate font-mono text-[12px] text-[var(--text-primary)]"
          >
            {item.path}
          </span>
          {#if item.status === "new"}
            <span class="chip accent shrink-0">{$t("extractor.applyNew")}</span>
          {:else if item.status === "changed"}
            <span class="chip shrink-0 text-[var(--warning)]">
              {$t("extractor.applyChanges", {
                added: item.added,
                removed: item.removed,
              })}
            </span>
          {:else}
            <span class="chip shrink-0">{$t("extractor.applySame")}</span>
          {/if}
        </li>
      {/each}
    </ul>

    {#if failures.length > 0}
      <ul
        class="border-t border-[var(--error)]/30 bg-[var(--error)]/10 px-6 py-2"
        role="alert"
      >
        {#each failures as failure (failure.path)}
          <li class="py-0.5 text-[11px] text-[var(--error)]">
            {failure.path}: {failure.reason}
          </li>
        {/each}
      </ul>
    {/if}

    <div
      class="flex justify-end gap-2 border-t border-[var(--border)] px-6 py-4"
    >
      <button
        type="button"
        class="btn btn-outline btn-md"
        onclick={onClose}
        disabled={isWriting}
      >
        {$t("common.cancel")}
      </button>
      <button
        type="button"
        class="btn btn-primary btn-md"
        onclick={() => void handleWrite()}
        disabled={isWriting || selectedPaths.size === 0}
      >
        {#if isWriting}
          <LoaderCircle size={14} class="animate-spin" />
          {$t("extractor.applyWriting")}
        {:else}
          {$t("extractor.applyWrite", { count: selectedPaths.size })}
        {/if}
      </button>
    </div>
  {/if}
</ModalShell>
