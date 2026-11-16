<script lang="ts">
  import { t } from "$lib/i18n";
  import { Pencil, Plus, Star, Trash2 } from "@lucide/svelte";

  import Checkbox from "../ui/Checkbox.svelte";
  import type { Tag } from "../../types";

  /** Строка тега в менеджере тегов (этап 15.2). */
  interface Props {
    tag: Tag;
    selected: boolean;
    onToggleSelect: () => void;
    onToggleFavorite: () => void;
    onApply: () => void;
    onEdit: () => void;
    onDelete: () => void;
  }

  let {
    tag,
    selected,
    onToggleSelect,
    onToggleFavorite,
    onApply,
    onEdit,
    onDelete,
  }: Props = $props();

  const favoriteLabel = $derived(
    tag.favorite ? $t("tags.unfavorite") : $t("tags.addFavorite"),
  );
</script>

<div
  class="group flex items-center gap-3 border-b border-[var(--border)] px-6 py-3 transition-colors hover:bg-[var(--bg-light)]"
>
  <div class="shrink-0">
    <Checkbox
      checked={selected}
      onToggle={onToggleSelect}
      ariaLabel={selected ? $t("common.deselect") : $t("common.select")}
    />
  </div>

  <div class="min-w-0 flex-1">
    <p class="truncate text-sm font-medium text-[var(--text-primary)]">
      {tag.name}
    </p>
    <p class="mt-0.5 truncate text-xs text-[var(--text-tertiary)]">
      {tag.value}
    </p>
  </div>

  <button
    type="button"
    onclick={onToggleFavorite}
    class="flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors {tag.favorite
      ? 'text-[var(--accent)] hover:bg-[var(--accent-dim)]'
      : 'text-[var(--text-tertiary)] hover:bg-[var(--bg-lighter)] hover:text-[var(--accent-hover)]'}"
    title={favoriteLabel}
    aria-label={favoriteLabel}
    aria-pressed={tag.favorite}
  >
    <Star size={16} class={tag.favorite ? "fill-current" : ""} />
  </button>

  <div class="flex shrink-0 items-center gap-0.5">
    <button
      type="button"
      onclick={onApply}
      class="icon-btn hover:bg-[var(--accent-dim)] hover:text-[var(--accent)]"
      title={$t("tags.apply")}
      aria-label={$t("tags.applyTag", { name: tag.name })}
    >
      <Plus size={15} />
    </button>
    <button
      type="button"
      onclick={onEdit}
      class="icon-btn"
      title={$t("common.edit")}
      aria-label={$t("tags.editTag", { name: tag.name })}
    >
      <Pencil size={15} />
    </button>
    <button
      type="button"
      onclick={onDelete}
      class="icon-btn danger"
      title={$t("common.delete")}
      aria-label={$t("tags.deleteTag", { name: tag.name })}
    >
      <Trash2 size={15} />
    </button>
  </div>
</div>
