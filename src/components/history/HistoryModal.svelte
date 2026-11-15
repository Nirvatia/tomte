<script lang="ts">
  import { formatRelativeTime, t } from "$lib/i18n";
  import { History, RotateCcw, Save, Trash2 } from "@lucide/svelte";

  import ModalShell from "../ui/ModalShell.svelte";

  import { activeProject, historyFileId } from "../../stores";
  import { requestConfirm } from "../../stores/confirm";
  import { notifyError, notifyInfo } from "$lib/notify";
  import {
    deleteFileVersion,
    restoreFileVersion,
    saveFileVersion,
  } from "../../utils/projectActions";
  import { diffLines, countChanges } from "../../utils/diff";
  import { htmlToMarkdown } from "../../utils/export/md";
  import { getErrorMessage } from "../../utils";

  const file = $derived(
    $activeProject?.files.find((f) => f.id === $historyFileId) ?? null,
  );

  /** Версии от старых к новым; показываем в обратном порядке. */
  const versions = $derived(
    (file && $activeProject?.fileVersions?.[file.id]) || [],
  );

  let selectedId = $state<string | null>(null);

  const selected = $derived(
    versions.find((v) => v.id === selectedId) ?? versions.at(-1) ?? null,
  );

  // Содержимое в читаемом виде: HTML промпта → Markdown для diff.
  const currentText = $derived(file ? htmlToMarkdown(file.content) : "");
  const selectedText = $derived(
    selected ? htmlToMarkdown(selected.content) : "",
  );
  const diff = $derived(diffLines(selectedText, currentText));
  const changes = $derived(countChanges(diff));

  function close() {
    historyFileId.set(null);
    selectedId = null;
  }

  async function handleSave() {
    if (!file) return;
    try {
      if (await saveFileVersion(file.id)) {
        notifyInfo($t("history.saved"));
      }
    } catch (error) {
      notifyError(getErrorMessage(error, $t("history.errors.save")));
    }
  }

  async function handleRestore(versionId: string) {
    if (!file) return;
    try {
      if (await restoreFileVersion(file.id, versionId)) {
        notifyInfo($t("history.restored"));
      }
    } catch (error) {
      notifyError(getErrorMessage(error, $t("history.errors.restore")));
    }
  }

  async function handleDelete(versionId: string) {
    if (!file) return;
    const confirmed = await requestConfirm({
      title: $t("history.deleteConfirm"),
      message: "",
      confirmText: $t("common.delete"),
      cancelText: $t("common.cancel"),
      danger: true,
    });
    if (!confirmed) return;
    try {
      await deleteFileVersion(file.id, versionId);
      if (selectedId === versionId) selectedId = null;
    } catch (error) {
      notifyError(getErrorMessage(error, $t("history.errors.delete")));
    }
  }
</script>

{#if file && $historyFileId}
  <ModalShell
    label={$t("history.title", { name: file.name })}
    onClose={close}
    width="max-w-3xl"
  >
    <div
      class="flex items-center justify-between border-b border-[var(--border)] px-6 py-4"
    >
      <h2
        class="flex items-center gap-2 text-lg font-bold text-[var(--text-primary)]"
      >
        <History size={18} class="text-[var(--accent)]" />
        {$t("history.title", { name: file.name })}
      </h2>
      <button
        type="button"
        class="btn btn-primary btn-sm"
        onclick={() => void handleSave()}
      >
        <Save size={14} />
        {$t("history.save")}
      </button>
    </div>

    {#if versions.length === 0}
      <p class="px-6 py-10 text-center text-sm text-[var(--text-tertiary)]">
        {$t("history.empty")}
      </p>
    {:else}
      <div class="grid max-h-[60vh] grid-cols-[220px_1fr]">
        <ul class="overflow-y-auto border-r border-[var(--border)] py-2">
          {#each [...versions].reverse() as version, index (version.id)}
            {@const number = versions.length - index}
            <li>
              <div
                class="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors {selected?.id ===
                version.id
                  ? 'bg-[var(--accent-dim)]'
                  : 'hover:bg-[var(--bg-light)]'}"
              >
                <button
                  type="button"
                  class="min-w-0 flex-1"
                  onclick={() => (selectedId = version.id)}
                >
                  <span
                    class="block text-[13px] font-medium text-[var(--text-primary)]"
                  >
                    {$t("history.version", { n: number })}
                  </span>
                  <span class="block text-[11px] text-[var(--text-tertiary)]">
                    {formatRelativeTime(version.createdAt)}
                  </span>
                </button>
                <button
                  type="button"
                  class="icon-btn"
                  title={$t("history.restore")}
                  aria-label={$t("history.restore")}
                  onclick={() => void handleRestore(version.id)}
                >
                  <RotateCcw size={13} />
                </button>
                <button
                  type="button"
                  class="icon-btn danger"
                  title={$t("common.delete")}
                  aria-label={$t("history.deleteVersion", { n: number })}
                  onclick={() => void handleDelete(version.id)}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </li>
          {/each}
        </ul>

        <div class="flex min-h-0 flex-col">
          <p
            class="border-b border-[var(--border)] px-4 py-2 text-[11px] text-[var(--text-tertiary)]"
          >
            {$t("history.diffLegend")}
            {#if changes.added + changes.removed > 0}
              · +{changes.added} / −{changes.removed}
            {:else}
              · {$t("history.current")}
            {/if}
          </p>
          <pre
            class="flex-1 overflow-auto px-4 py-3 font-mono text-[12px] leading-relaxed whitespace-pre-wrap"><code
              >{#each diff as line (line.text + line.type)}<span
                  class="block px-1 {line.type === 'add'
                    ? 'bg-[var(--success)]/10 text-[var(--success)]'
                    : line.type === 'remove'
                      ? 'bg-[var(--error)]/10 text-[var(--error)] line-through'
                      : 'text-[var(--text-secondary)]'}"
                  >{line.text || " "}</span
                >{/each}</code
            ></pre>
        </div>
      </div>
    {/if}
  </ModalShell>
{/if}
