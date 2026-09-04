<script lang="ts">
  import {
    Pencil,
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

  import { pluralize } from "../../utils";
  import {
    addTag,
    loadTags,
    removeTags,
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
  let formTagName = $state("");
  let formTagValue = $state("");
  let formEditingId = $state<string | null>(null);
  let formNameInput = $state<HTMLInputElement | null>(null);

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

  function handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      close();
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      if (isFormMode) {
        closeForm();
      } else {
        close();
      }
    }
  }

  function openCreateForm() {
    formEditingId = null;
    formTagName = "";
    formTagValue = "";
    isFormMode = true;
    setTimeout(() => formNameInput?.focus(), 50);
  }

  function openEditForm(tag: Tag) {
    formEditingId = tag.id;
    formTagName = tag.name;
    formTagValue = tag.value;
    isFormMode = true;
    setTimeout(() => formNameInput?.focus(), 50);
  }

  function closeForm() {
    isFormMode = false;
    formTagName = "";
    formTagValue = "";
    formEditingId = null;
  }

  function handleFormSubmit() {
    if (!formTagName.trim() || !formTagValue.trim()) return;
    if (formEditingId) {
      updateTag(formEditingId, formTagName, formTagValue);
    } else {
      addTag(formTagName, formTagValue);
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
      title: "Удалить теги?",
      message:
        `Будет удалено ${selectedCount} ${pluralize(selectedCount, "тег", "тега", "тегов")}.\n` +
        `Это действие нельзя отменить.`,
      confirmText: "Удалить",
      cancelText: "Отмена",
      danger: true,
    });
    if (!confirmed) return;
    removeTags(selectedIds);
    selectedIds = new Set();
    refresh();
    bumpTagsVersion();
  }

  async function handleDeleteOne(tag: Tag) {
    const confirmed = await requestConfirm({
      title: "Удалить тег?",
      message: `Тег «${tag.name}» будет удалён.\nЭто действие нельзя отменить.`,
      confirmText: "Удалить",
      cancelText: "Отмена",
      danger: true,
    });
    if (!confirmed) return;
    removeTags(new Set([tag.id]));
    selectedIds = new Set([...selectedIds].filter((id) => id !== tag.id));
    refresh();
    bumpTagsVersion();
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

<svelte:window onkeydown={handleKeydown} />

{#if $isTagManagerOpen}
  <!-- Оверлей / Бэкдроп -->
  <div
    class="fixed inset-0 z-50 flex animate-fade-in items-center justify-center bg-black/60 p-4 backdrop-blur-[2px]"
    onclick={handleBackdropClick}
    role="presentation"
  >
    <!-- Диалоговое окно -->
    <div
      class="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-xl border border-[var(--border-light)] bg-[var(--bg-dark)] shadow-[var(--shadow-lg)]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="manager-modal-title"
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
            Менеджер тегов
          </h2>
          <p class="mt-1 text-sm text-[var(--text-tertiary)]">
            Всего:
            <strong class="font-semibold text-[var(--text-primary)]"
              >{tags.length}</strong
            >
            {#if favoritesCount > 0}
              <span class="ml-3 text-[var(--border-light)]">·</span>
              <span class="ml-3 font-medium text-[var(--accent-hover)]">
                ★ {favoritesCount} избранных
              </span>
            {/if}
          </p>
        </div>
        <button
          type="button"
          onclick={close}
          class="rounded-lg p-2 text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-lighter)] hover:text-[var(--text-primary)]"
          aria-label="Закрыть менеджер тегов"
        >
          <X size={20} />
        </button>
      </div>

      {#if isFormMode}
        <div class="space-y-4 overflow-y-auto p-6">
          <div>
            <label
              for="tag-name"
              class="mb-2 block font-mono text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]"
            >
              Название
            </label>
            <input
              bind:this={formNameInput}
              bind:value={formTagName}
              id="tag-name"
              type="text"
              placeholder="Например: + Без тестов"
              class="w-full rounded-md border border-[var(--border)] bg-[var(--bg-darkest)] px-3.5 py-2.5 text-sm text-[var(--text-primary)] transition-all placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent)]/60 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/15"
              maxlength="50"
            />
            <p class="mt-1.5 text-xs text-[var(--text-tertiary)]">
              Короткое название для кнопки (макс. 50 символов)
            </p>
          </div>
          <div>
            <label
              for="tag-value"
              class="mb-2 block font-mono text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]"
            >
              Текст инструкции
            </label>
            <textarea
              bind:value={formTagValue}
              id="tag-value"
              placeholder="Введите полный текст инструкции, который будет вставляться в промпт..."
              rows="8"
              class="w-full resize-none rounded-md border border-[var(--border)] bg-[var(--bg-darkest)] px-3.5 py-2.5 font-mono text-sm text-[var(--text-primary)] transition-all placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent)]/60 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/15"
              maxlength="5000"
            ></textarea>
            <p class="mt-1.5 text-xs text-[var(--text-tertiary)]">
              Этот текст будет вставлен в редактор при клике на тег (макс. 5000
              символов)
            </p>
          </div>
        </div>

        <div
          class="flex justify-end gap-3 rounded-b-xl border-t border-[var(--border)] bg-[var(--bg-medium)] p-5"
        >
          <button
            type="button"
            onclick={closeForm}
            class="rounded-md bg-[var(--bg-lighter)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-light)] hover:text-[var(--text-primary)]"
          >
            Отмена
          </button>
          <button
            type="button"
            onclick={handleFormSubmit}
            disabled={!formTagName.trim() || !formTagValue.trim()}
            class="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--bg-darkest)] transition-colors hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {formEditingId ? "Сохранить" : "Создать"}
          </button>
        </div>
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
              placeholder="Поиск по имени тега..."
              class="w-full rounded-md border border-[var(--border)] bg-[var(--bg-darkest)] py-2 pl-9 pr-3 text-sm text-[var(--text-primary)] transition-all placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent)]/60 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/15"
              aria-label="Поиск тегов"
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
            {showOnlyFavorites ? "Только избранные" : "Избранные"}
          </button>

          {#if selectedCount > 0}
            <button
              type="button"
              onclick={() => void handleDeleteSelected()}
              class="inline-flex h-9 items-center gap-1.5 rounded-md border border-[var(--error)]/40 bg-[var(--error)]/10 px-3 text-xs font-medium text-[var(--error)] transition-colors hover:bg-[var(--error)]/20"
            >
              <Trash2 size={14} />
              Удалить ({selectedCount})
            </button>
            <button
              type="button"
              onclick={deselectAll}
              class="inline-flex h-9 items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--bg-dark)] px-3 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-lighter)] hover:text-[var(--text-primary)]"
            >
              Снять выделение
            </button>
          {/if}

          <button
            type="button"
            onclick={openCreateForm}
            class="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md bg-[var(--accent)] px-4 text-xs font-semibold text-[var(--bg-darkest)] transition-colors hover:bg-[var(--accent-hover)]"
          >
            <Plus size={14} />
            Новый тег
          </button>
        </div>

        <div class="min-h-0 flex-1 overflow-y-auto">
          {#if filteredTags.length === 0}
            <div class="py-16 text-center">
              <TagIcon size={40} class="mx-auto mb-3 text-[var(--text-dim)]" />
              <p class="text-sm font-medium text-[var(--text-secondary)]">
                {searchQuery.trim() || showOnlyFavorites
                  ? "Ничего не найдено"
                  : "Нет тегов"}
              </p>
              {#if searchQuery.trim() || showOnlyFavorites}
                <p class="mt-1 text-xs text-[var(--text-tertiary)]">
                  Попробуйте изменить фильтр
                </p>
              {:else}
                <p class="mt-1 text-xs text-[var(--text-tertiary)]">
                  Создайте первый тег, чтобы быстро вставлять инструкции в
                  промпт
                </p>
              {/if}
            </div>
          {:else}
            <div
              class="sticky top-0 z-10 flex items-center gap-3 border-b border-[var(--border)] bg-[var(--bg-light)] px-6 py-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]"
            >
              <button
                type="button"
                onclick={toggleSelectAll}
                class="flex h-4 w-4 shrink-0 items-center justify-center"
                aria-label={allFilteredSelected
                  ? "Снять выделение"
                  : "Выбрать все"}
              >
                {#if allFilteredSelected}
                  <Checkbox
                    checked={true}
                    ariaLabel="Снять выделение"
                    onToggle={toggleSelectAll}
                  />
                {:else if someFilteredSelected}
                  <Checkbox
                    indeterminate={true}
                    ariaLabel="Выбрать все"
                    onToggle={toggleSelectAll}
                  />
                {:else}
                  <Checkbox
                    checked={false}
                    ariaLabel="Выбрать все"
                    onToggle={toggleSelectAll}
                  />
                {/if}
              </button>
              <span class="flex-1">Название</span>
              <span class="w-20 text-center">Избранный</span>
              <span class="w-28 text-right">Действия</span>
            </div>

            <div>
              {#each filteredTags as tag (tag.id)}
                <div
                  class="group flex items-center gap-3 border-b border-[var(--border)] px-6 py-3 transition-colors hover:bg-[var(--bg-light)]"
                >
                  <div class="shrink-0">
                    <Checkbox
                      checked={selectedIds.has(tag.id)}
                      onToggle={() => toggleSelect(tag.id)}
                      ariaLabel={selectedIds.has(tag.id)
                        ? "Снять выделение"
                        : "Выделить"}
                    />
                  </div>

                  <div class="min-w-0 flex-1">
                    <p
                      class="truncate text-sm font-medium text-[var(--text-primary)]"
                    >
                      {tag.name}
                    </p>
                    <p
                      class="mt-0.5 truncate text-xs text-[var(--text-tertiary)]"
                    >
                      {tag.value}
                    </p>
                  </div>

                  <button
                    type="button"
                    onclick={() => handleToggleFavorite(tag)}
                    class="flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors {tag.favorite
                      ? 'text-[var(--accent)] hover:bg-[var(--accent-dim)]'
                      : 'text-[var(--text-tertiary)] hover:bg-[var(--bg-lighter)] hover:text-[var(--accent-hover)]'}"
                    title={tag.favorite
                      ? "Убрать из избранных"
                      : "Добавить в избранные"}
                    aria-label={tag.favorite
                      ? "Убрать из избранных"
                      : "Добавить в избранные"}
                  >
                    <Star
                      size={16}
                      class={tag.favorite ? "fill-current" : ""}
                    />
                  </button>

                  <div class="flex shrink-0 items-center gap-0.5">
                    <button
                      type="button"
                      onclick={() => handleApply(tag)}
                      class="rounded-md p-1.5 text-[var(--text-tertiary)] transition-colors hover:bg-[var(--accent-dim)] hover:text-[var(--accent)]"
                      title="Применить к редактору"
                      aria-label="Применить тег {tag.name}"
                    >
                      <Plus size={15} />
                    </button>
                    <button
                      type="button"
                      onclick={() => openEditForm(tag)}
                      class="rounded-md p-1.5 text-[var(--text-tertiary)] transition-colors hover:bg-[var(--bg-lighter)] hover:text-[var(--text-primary)]"
                      title="Редактировать"
                      aria-label="Редактировать тег {tag.name}"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      type="button"
                      onclick={() => void handleDeleteOne(tag)}
                      class="rounded-md p-1.5 text-[var(--text-tertiary)] transition-colors hover:bg-[var(--error)]/10 hover:text-[var(--error)]"
                      title="Удалить"
                      aria-label="Удалить тег {tag.name}"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      {/if}
    </div>
  </div>
{/if}
