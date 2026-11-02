<script lang="ts">
  import { X } from "@lucide/svelte";

  import ModalShell from "../ui/ModalShell.svelte";
  import { HOTKEYS, formatHotkey } from "$lib/hotkeys";
  import { isShortcutsOpen } from "../../stores";

  /** Сочетания редактора: их обрабатывает Tiptap, здесь только для справки. */
  const EDITOR_KEYS = [
    { keys: "Mod+B", description: "Жирный" },
    { keys: "Mod+I", description: "Курсив" },
    { keys: "Mod+U", description: "Подчёркнутый" },
    { keys: "Mod+Z", description: "Отменить" },
    { keys: "Mod+Shift+Z", description: "Повторить" },
    { keys: "Mod+Shift+L", description: "Выровнять влево" },
    { keys: "Mod+Shift+E", description: "Выровнять по центру" },
    { keys: "Mod+Shift+R", description: "Выровнять вправо" },
  ];

  const close = () => isShortcutsOpen.set(false);
</script>

{#if $isShortcutsOpen}
  <ModalShell label="Горячие клавиши" onClose={close}>
    <div
      class="flex items-center justify-between border-b border-[var(--border)] px-5 py-3"
    >
      <h2 class="text-sm font-semibold text-[var(--text-primary)]">
        Горячие клавиши
      </h2>
      <button
        type="button"
        onclick={close}
        class="rounded p-1 text-[var(--text-secondary)] hover:bg-[var(--bg-lighter)] hover:text-[var(--text-primary)]"
        aria-label="Закрыть"
      >
        <X size={16} />
      </button>
    </div>
    <div class="grid gap-5 px-5 py-4 text-[13px] sm:grid-cols-2">
      {#each [{ title: "Приложение", items: HOTKEYS }, { title: "Редактор", items: EDITOR_KEYS }] as group (group.title)}
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
                  {item.description}
                  {#if "note" in item && item.note}
                    <span class="block text-[11px] text-[var(--text-tertiary)]"
                      >{item.note}</span
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
