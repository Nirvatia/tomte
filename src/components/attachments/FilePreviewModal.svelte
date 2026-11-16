<script lang="ts">
  import ModalShell from "../ui/ModalShell.svelte";
  import { t } from "$lib/i18n";
  import { FileText, Image as ImageIcon, X } from "@lucide/svelte";

  import type { AttachedFile } from "../../types";

  interface Props {
    file?: AttachedFile | null;
    onClose?: () => void;
  }

  let { file = null, onClose = () => {} }: Props = $props();
</script>

{#if file}
  <ModalShell
    label={$t("files.previewOf", { name: file.name })}
    {onClose}
    width="max-w-4xl"
    panelClass="flex max-h-[85vh] flex-col"
  >
    <div
      class="flex items-center justify-between border-b border-[var(--border)] p-6"
    >
      <div class="flex items-center gap-3">
        {#if file.type === "image"}
          <div
            class="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--accent-dim)]"
          >
            <ImageIcon size={20} class="text-[var(--accent-hover)]" />
          </div>
        {:else}
          <div
            class="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--success)]/10"
          >
            <FileText size={20} class="text-[var(--success)]" />
          </div>
        {/if}

        <div>
          <h2 class="text-lg font-bold text-[var(--text-primary)]">
            {file.name}
          </h2>
          <p class="mt-0.5 font-mono text-xs text-[var(--text-tertiary)]">
            {file.type === "image"
              ? $t("files.typeImage")
              : file.type === "binary"
                ? $t("tree.file")
                : $t("files.typeText")} ·
            {$t("files.bytes", { count: file.size })}
          </p>
        </div>
      </div>

      <button
        type="button"
        onclick={onClose}
        class="icon-btn"
        aria-label={$t("files.closePreview")}
      >
        <X size={20} />
      </button>
    </div>

    <div class="flex-1 overflow-auto p-6">
      {#if file.type === "image" && file.dataUrl}
        <div class="flex items-center justify-center">
          <img
            src={file.dataUrl}
            alt={file.name}
            class="max-h-[70vh] max-w-full rounded-lg border border-[var(--border-light)] shadow-lg"
          />
        </div>
      {:else if file.type === "text" && typeof file.content === "string"}
        <pre
          class="overflow-auto whitespace-pre-wrap rounded-lg border border-[var(--border)] bg-[var(--bg-darkest)] p-4 font-mono text-sm text-[var(--text-secondary)]">{file.content}</pre>
      {:else}
        <div class="py-20 text-center">
          <p class="text-sm font-medium text-[var(--text-secondary)]">
            {$t("files.noContent")}
          </p>
          <p
            class="mx-auto mt-2 max-w-md text-xs leading-relaxed text-[var(--text-tertiary)]"
          >
            {#if file.type === "binary"}
              {$t("files.binaryNote")}
            {:else}
              {$t("files.metadataNote")}
            {/if}
          </p>
        </div>
      {/if}
    </div>
  </ModalShell>
{/if}
