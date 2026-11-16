<script lang="ts">
  import { t } from "$lib/i18n";
  import { notifyUndo } from "$lib/notify";
  import {
    Plus,
    Search,
    Star,
    StarOff,
    Tag as TagIcon,
    Trash2,
    X,
  } from "@lucide/svelte";

  import type { Editor } from "@tiptap/core";
  import type { Tag } from "../../types";

  import { isTagManagerOpen, tagsVersion } from "../../stores";
  import { requestConfirm } from "../../stores/confirm";

  import Checkbox from "../ui/Checkbox.svelte";
  import ModalShell from "../ui/ModalShell.svelte";
  import TagForm from "./TagForm.svelte";
  import TagRow from "./TagRow.svelte";

  import {
    addTag,
    loadTags,
    removeTags,
    removeTagWithUndo,
    sortTags,
    toggleFavorite,
    updateTag,
  } from "../../utils/tags";

  interface Props {
    editor?: Editor | null;
  }

  let { editor = null }: Props = $props();

  let tags = $state<Tag[]>([]);
  let searchQuery = $state("");
  let showOnlyFavorites = $state(false);
  let selectedIds = $state<Set<string>>(new Set());

  let isFormMode = $state(false);
  /** Тег в форме правки; null — создание нового. */
  let formTag = $state<Tag | null>(null);

  $effect(() => {
    if ($isTagManagerOpen) {
      refresh();
      searchQuery = "";
      selectedIds = new Set();
      showOnlyFavorites = false;
      closeForm();
    }
  });

  function refresh() {
    tags = loadTags();
  }

  function bumpTagsVersion() {
    tagsVersion.update((v) => v + 1);
  }

  const filteredTags = $derived(
    sortTags(
      tags.filter((t) => {
        if (showOnlyFavorites && !t.favorite) return false;
        if (!searchQuery.trim()) return true;
        return t.name.toLowerCase().includes(searchQuery.trim().toLowerCase());
      }),
    ),
  );

  const selectedCount = $derived(selectedIds.size);
  const favoritesCount = $derived(tags.filter((t) => t.favorite).length);
  const allFilteredSelected = $derived(
    filteredTags.length > 0 && filteredTags.every((t) => selectedIds.has(t.id)),
  );
  const someFilteredSelected = $derived(
    !allFilteredSelected && filteredTags.some((t) => selectedIds.has(t.id)),
  );

  function close() {
    isTagManagerOpen.set(false);
  }

  // Escape сначала закрывает форму тега, потом сам менеджер.
  function handleEscape() {
    if (isFormMode) {
      closeForm();
    } else {
      close();
    }
  }

  function openCreateForm() {
    formTag = null;
    isFormMode = true;
  }

  function openEditForm(tag: Tag) {
    formTag = tag;
    isFormMode = true;
  }

  function closeForm() {
    isFormMode = false;
    formTag = null;
  }

  function handleFormSubmit(name: string, value: string) {
    if (formTag) {
      updateTag(formTag.id, name, value);
    } else {
      addTag(name, value);
    }
    closeForm();
    refresh();
    bumpTagsVersion();
  }

  function toggleSelect(id: string) {
    selectedIds = new Set(selectedIds);
    if (selectedIds.has(id)) {
      selectedIds.delete(id);
    } else {
      selectedIds.add(id);
    }
  }

  function toggleSelectAll() {
    if (allFilteredSelected) {
      const filteredIds = new Set(filteredTags.map((t) => t.id));
      selectedIds = new Set(
        [...selectedIds].filter((id) => !filteredIds.has(id)),
      );
    } else {
      const merged = new Set(selectedIds);
      for (const t of filteredTags) {
        merged.add(t.id);
      }
      selectedIds = merged;
    }
  }

  function deselectAll() {
    selectedIds = new Set();
  }

  async function handleDeleteSelected() {
    if (selectedCount === 0) return;
    const confirmed = await requestConfirm({
      title: $t("tags.deleteMany.title"),
      message: $t("tags.deleteMany.message", { count: selectedCount }),
      confirmText: $t("common.delete"),
      cancelText: $t("common.cancel"),
      danger: true,
    });
    if (!confirmed) return;
    removeTags(selectedIds);
    selectedIds = new Set();
    refresh();
    bumpTagsVersion();
  }

  // Один тег удаляется сразу, с отменой в уведомлении (решение этапа 5).
  function handleDeleteOne(tag: Tag) {
    const undo = removeTagWithUndo(tag.id);
    selectedIds = new Set([...selectedIds].filter((id) => id !== tag.id));
    refresh();
    bumpTagsVersion();
    if (!undo) return;
    notifyUndo($t("tags.deleted", { name: tag.name }), () => {
      undo();
      refresh();
      bumpTagsVersion();
    });
  }

  function handleToggleFavorite(tag: Tag) {
    toggleFavorite(tag.id);
    refresh();
    bumpTagsVersion();
  }

  function handleApply(tag: Tag) {
    if (!editor) return;
    const currentText = editor.getText();
    const prefix =
      currentText.length > 0 && !currentText.endsWith("\n") ? "\n" : "";
    editor
      .chain()
      .focus()
      .insertContent(prefix + tag.value + "\n")
      .run();
    close();
  }
</script>

{#if $isTagManagerOpen}
  <ModalShell
    label={$t("tags.manager")}
    onClose={close}
    onEscape={handleEscape}
    width="max-w-3xl"
    panelClass="flex max-h-[85vh] flex-col"
  >
    <div
      class="flex items-center justify-between border-b border-[var(--border)] p-6"
    >
      <div>
        <h2
          id="manager-modal-title"
          class="flex items-center gap-2 text-xl font-bold text-[var(--text-primary)]"
        >
          <TagIcon size={22} class="text-[var(--accent)]" />
          {$t("tags.manager")}
        </h2>
        <p class="mt-1 text-sm text-[var(--text-tertiary)]">
          {$t("common.total")}
          <strong class="font-semibold text-[var(--text-primary)]"
            >{tags.length}</strong
          >
          {#if favoritesCount > 0}
            <span class="ml-3 text-[var(--border-light)]">·</span>
            <span class="ml-3 font-medium text-[var(--accent-hover)]">
              {$t("tags.favoritesCount", { count: favoritesCount })}
            </span>
          {/if}
        </p>
      </div>
      <button
        type="button"
        onclick={close}
        class="icon-btn"
        aria-label={$t("tags.closeManager")}
      >
        <X size={20} />
      </button>
    </div>

    {#if isFormMode}
      <TagForm
        initialName={formTag?.name}
        initialValue={formTag?.value}
        isEditing={Boolean(formTag)}
        rows={8}
        onSubmit={handleFormSubmit}
        onCancel={closeForm}
      />
    {:else}
      <div
        class="flex flex-wrap items-center gap-2 border-b border-[var(--border)] bg-[var(--bg-medium)] px-6 py-4"
      >
        <div class="relative min-w-[200px] flex-1">
          <Search
            size={15}
            class="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]"
          />
          <input
            type="text"
            bind:value={searchQuery}
            placeholder={$t("tags.searchPlaceholder")}
            class="input w-full pl-9"
            aria-label={$t("tags.search")}
          />
        </div>

        <button
          type="button"
          onclick={() => (showOnlyFavorites = !showOnlyFavorites)}
          class="inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-xs font-medium transition-colors {showOnlyFavorites
            ? 'border-[var(--accent)] bg-[var(--accent-dim)] text-[var(--accent-hover)]'
            : 'border-[var(--border)] bg-[var(--bg-dark)] text-[var(--text-secondary)] hover:bg-[var(--bg-lighter)] hover:text-[var(--text-primary)]'}"
        >
          {#if showOnlyFavorites}
            <Star size={14} class="fill-current" />
          {:else}
            <StarOff size={14} />
          {/if}
          {showOnlyFavorites ? $t("tags.onlyFavorites") : $t("tags.favorites")}
        </button>

        {#if selectedCount > 0}
          <button
            type="button"
            onclick={() => void handleDeleteSelected()}
            class="btn btn-danger btn-md"
          >
            <Trash2 size={14} />
            {$t("common.deleteCount", { count: selectedCount })}
          </button>
          <button
            type="button"
            onclick={deselectAll}
            class="btn btn-outline btn-md"
          >
            {$t("common.deselect")}
          </button>
        {/if}

        <button
          type="button"
          onclick={openCreateForm}
          class="btn btn-primary btn-md shrink-0"
        >
          <Plus size={14} />
          {$t("tags.new")}
        </button>
      </div>

      <div class="min-h-0 flex-1 overflow-y-auto">
        {#if filteredTags.length === 0}
          <div class="py-16 text-center">
            <TagIcon size={40} class="mx-auto mb-3 text-[var(--text-dim)]" />
            <p class="text-sm font-medium text-[var(--text-secondary)]">
              {searchQuery.trim() || showOnlyFavorites
                ? $t("common.nothingFound")
                : $t("tags.empty")}
            </p>
            {#if searchQuery.trim() || showOnlyFavorites}
              <p class="mt-1 text-xs text-[var(--text-tertiary)]">
                {$t("tags.tryFilter")}
              </p>
            {:else}
              <p class="mt-1 text-xs text-[var(--text-tertiary)]">
                {$t("tags.emptyHint")}
              </p>
            {/if}
          </div>
        {:else}
          <div
            class="sticky top-0 z-[var(--layer-raised)] flex items-center gap-3 border-b border-[var(--border)] bg-[var(--bg-light)] px-6 py-2 text-caption font-semibold uppercase tracking-wider text-[var(--text-tertiary)]"
          >
            <button
              type="button"
              onclick={toggleSelectAll}
              class="flex h-4 w-4 shrink-0 items-center justify-center"
              aria-label={allFilteredSelected
                ? $t("common.deselect")
                : $t("common.selectAll")}
            >
              {#if allFilteredSelected}
                <Checkbox
                  checked={true}
                  ariaLabel={$t("common.deselect")}
                  onToggle={toggleSelectAll}
                />
              {:else if someFilteredSelected}
                <Checkbox
                  indeterminate={true}
                  ariaLabel={$t("common.selectAll")}
                  onToggle={toggleSelectAll}
                />
              {:else}
                <Checkbox
                  checked={false}
                  ariaLabel={$t("common.selectAll")}
                  onToggle={toggleSelectAll}
                />
              {/if}
            </button>
            <span class="flex-1">{$t("tags.name")}</span>
            <span class="w-20 text-center">{$t("tags.favorite")}</span>
            <span class="w-28 text-right">{$t("common.actions")}</span>
          </div>

          <div>
            {#each filteredTags as tag (tag.id)}
              <TagRow
                {tag}
                selected={selectedIds.has(tag.id)}
                onToggleSelect={() => toggleSelect(tag.id)}
                onToggleFavorite={() => handleToggleFavorite(tag)}
                onApply={() => handleApply(tag)}
                onEdit={() => openEditForm(tag)}
                onDelete={() => void handleDeleteOne(tag)}
              />
            {/each}
          </div>
        {/if}
      </div>
    {/if}
  </ModalShell>
{/if}
