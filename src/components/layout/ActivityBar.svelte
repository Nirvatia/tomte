<script lang="ts">
  import { t } from "$lib/i18n";
  import type { MessageKey } from "$lib/i18n/types";
  import { Brain, FolderKanban, Map, Tag } from "@lucide/svelte";
  import type { Component } from "svelte";
  import { fromStore, type Writable } from "svelte/store";
  import {
    isCodeMapOpen,
    isExtractorOpen,
    isProjectManagerOpen,
    isTagManagerOpen,
  } from "../../stores";

  /**
   * Боковая панель: менеджеры и экстрактор. Иконки 24px в кнопках 44px —
   * крупнее, чем у обычных кнопок интерфейса: это главные входы в окна.
   */
  interface Item {
    open: Writable<boolean>;
    icon: Component<{ size?: number; strokeWidth?: number }>;
    label: MessageKey;
    title: MessageKey;
  }

  const ITEMS: Item[] = [
    {
      open: isProjectManagerOpen,
      icon: FolderKanban,
      label: "activity.projects",
      title: "projects.manager",
    },
    {
      open: isTagManagerOpen,
      icon: Tag,
      label: "activity.tags",
      title: "activity.tagsTitle",
    },
    {
      open: isCodeMapOpen,
      icon: Map,
      label: "activity.codeMap",
      title: "activity.codeMapTitle",
    },
    {
      open: isExtractorOpen,
      icon: Brain,
      label: "activity.extractor",
      title: "activity.extractorTitle",
    },
  ];

  // Состояние «окно открыто» каждой кнопки (подсветка).
  const openStates = ITEMS.map((item) => fromStore(item.open));
</script>

<div
  data-tour="activity"
  class="hidden w-16 shrink-0 flex-col items-center gap-2 border-r border-[var(--border)] bg-[var(--bg-dark)] py-3 lg:flex"
>
  {#each ITEMS as item, index (item.label)}
    {@const Icon = item.icon}
    {@const isActive = openStates[index].current}
    <button
      type="button"
      onclick={() => item.open.set(true)}
      class="relative flex h-12 w-12 cursor-pointer items-center justify-center rounded-md transition-colors {isActive
        ? 'bg-[var(--accent-dim)] text-[var(--accent)]'
        : 'text-[var(--text-tertiary)] hover:bg-[var(--bg-light)] hover:text-[var(--text-primary)]'}"
      aria-label={$t(item.label)}
      title={$t(item.title)}
    >
      {#if isActive}
        <div
          class="absolute left-0 top-2.5 bottom-2.5 w-[3px] rounded-r bg-[var(--accent)]"
        ></div>
      {/if}
      <Icon size={26} strokeWidth={1.75} />
    </button>
  {/each}
</div>
