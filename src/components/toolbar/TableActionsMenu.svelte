<script lang="ts">
  import { t } from "$lib/i18n";
  import { Columns3, Minus, Rows3, Table2, Trash } from "@lucide/svelte";
  import type { Editor } from "@tiptap/core";

  import Dropdown from "../ui/Dropdown.svelte";
  import { confirmDeleteTable } from "./editorCommands";

  /**
   * Действия с таблицей под курсором — одной кнопкой с меню: семь кнопок
   * в ряд переполняли тулбар, и «Инструменты» уезжали за край.
   */
  interface Props {
    editor: Editor | null;
  }

  let { editor }: Props = $props();

  const chain = () => editor?.chain().focus();

  const actions = $derived([
    {
      label: $t("toolbar.rowAbove"),
      icon: Rows3,
      run: () => chain()?.addRowBefore().run(),
    },
    {
      label: $t("toolbar.rowBelow"),
      icon: Rows3,
      iconClass: "rotate-180",
      run: () => chain()?.addRowAfter().run(),
    },
    {
      label: $t("toolbar.colLeft"),
      icon: Columns3,
      run: () => chain()?.addColumnBefore().run(),
      separatorBefore: true,
    },
    {
      label: $t("toolbar.colRight"),
      icon: Columns3,
      iconClass: "rotate-180",
      run: () => chain()?.addColumnAfter().run(),
    },
    {
      label: $t("toolbar.deleteRow"),
      icon: Minus,
      run: () => chain()?.deleteRow().run(),
      danger: true,
      separatorBefore: true,
    },
    {
      label: $t("toolbar.deleteCol"),
      icon: Minus,
      iconClass: "rotate-90",
      run: () => chain()?.deleteColumn().run(),
      danger: true,
    },
    {
      label: $t("toolbar.deleteTable.button"),
      icon: Trash,
      run: () => void confirmDeleteTable(editor),
      danger: true,
    },
  ]);
</script>

<Dropdown
  label={$t("toolbar.tableActions")}
  widthClass="w-60"
  triggerClass="h-8 text-[var(--warning)]"
>
  {#snippet trigger()}
    <Table2 size={16} aria-hidden="true" />
    <span class="hidden @3xl:inline">{$t("toolbar.table")}</span>
  {/snippet}
  {#each actions as item (item.label)}
    {#if item.separatorBefore}
      <div class="menu-sep"></div>
    {/if}
    <button
      type="button"
      role="menuitem"
      class="menu-item {item.danger ? 'danger' : ''}"
      onclick={item.run}
    >
      <item.icon size={14} class="shrink-0 {item.iconClass ?? ''}" />
      <span class="flex-1">{item.label}</span>
    </button>
  {/each}
</Dropdown>
