<script lang="ts">
  import { t } from "$lib/i18n";
  import type { MessageKey } from "$lib/i18n/types";
  import { X } from "@lucide/svelte";

  import ModalShell from "../ui/ModalShell.svelte";
  import { HOTKEYS, formatHotkey } from "$lib/hotkeys";
  import { isShortcutsOpen } from "../../stores";

  /** Сочетания редактора: их обрабатывает Tiptap, здесь только для справки. */
  const EDITOR_KEYS = [
    { keys: "Mod+B", description: "toolbar.bold" as MessageKey },
    { keys: "Mod+I", description: "toolbar.italic" as MessageKey },
    { keys: "Mod+U", description: "toolbar.underline" as MessageKey },
    { keys: "Mod+Z", description: "common.undo" as MessageKey },
    { keys: "Mod+Shift+Z", description: "common.redo" as MessageKey },
    { keys: "Mod+Shift+L", description: "shortcuts.alignLeft" as MessageKey },
    { keys: "Mod+Shift+E", description: "shortcuts.alignCenter" as MessageKey },
    { keys: "Mod+Shift+R", description: "shortcuts.alignRight" as MessageKey },
  ];

  /** Клавиши на файле в панели или на вкладке (с фокусом на элементе). */
  const LIST_KEYS = [
    { keys: "F2", description: "common.rename" as MessageKey },
    { keys: "Shift+F10", description: "shortcuts.contextMenu" as MessageKey },
    { keys: "Alt+↑ / Alt+↓", description: "shortcuts.moveFile" as MessageKey },
    { keys: "Alt+← / Alt+→", description: "shortcuts.moveTab" as MessageKey },
  ];

  const close = () => isShortcutsOpen.set(false);
</script>

{#if $isShortcutsOpen}
  <ModalShell label={$t("shortcuts.title")} onClose={close}>
    <div
      class="flex items-center justify-between border-b border-[var(--border)] px-5 py-3"
    >
      <h2 class="text-sm font-semibold text-[var(--text-primary)]">
        {$t("shortcuts.title")}
      </h2>
      <button
        type="button"
        onclick={close}
        class="rounded p-1 text-[var(--text-secondary)] hover:bg-[var(--bg-lighter)] hover:text-[var(--text-primary)]"
        aria-label={$t("common.close")}
      >
        <X size={16} />
      </button>
    </div>
    <div class="grid gap-5 px-5 py-4 text-[13px] sm:grid-cols-2">
      {#each [{ title: $t("shortcuts.app"), items: HOTKEYS }, { title: $t("shortcuts.editor"), items: EDITOR_KEYS }, { title: $t("shortcuts.lists"), items: LIST_KEYS }] as group (group.title)}
        <section>
          <h3
            class="mb-2 text-[11px] font-semibold tracking-wide text-[var(--text-tertiary)] uppercase"
          >
            {group.title}
          </h3>
          <dl class="space-y-1.5">
            {#each group.items as item (item.keys)}
              <div class="flex items-baseline justify-between gap-3">
                <dt class="text-[var(--text-secondary)]">
                  {$t(item.description)}
                  {#if "note" in item && item.note}
                    <span class="block text-[11px] text-[var(--text-tertiary)]"
                      >{$t(item.note as MessageKey)}</span
                    >
                  {/if}
                </dt>
                <dd>
                  <kbd
                    class="rounded border border-[var(--border-light)] bg-[var(--bg-medium)] px-1.5 py-0.5 font-mono text-[11px] whitespace-nowrap text-[var(--text-primary)]"
                  >
                    {formatHotkey(item.keys)}
                  </kbd>
                </dd>
              </div>
            {/each}
          </dl>
        </section>
      {/each}
    </div>
  </ModalShell>
{/if}
