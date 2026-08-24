<script lang="ts">
  import { Pencil, Plus, Star } from "@lucide/svelte";

  import type { Editor } from "@tiptap/core";
  import type { Tag } from "../../types";

  import { isTagManagerOpen, tagsVersion } from "../../stores";
  import { requestConfirm } from "../../stores/confirm";

  import TagCreateModal from "./TagCreateModal.svelte";

  import {
    addTag,
    loadTags,
    removeTag,
    sortTags,
    updateTag,
  } from "../../utils/tags";

  interface Props {
    editor?: Editor | null;
  }

  let { editor = null }: Props = $props();

  let tags = $state<Tag[]>([]);
  let isCreateModalOpen = $state(false);
  let editingTag = $state<Tag | null>(null);

  function refreshTags() {
    tags = loadTags();
  }

  $effect(() => {
    $tagsVersion;
    refreshTags();
  });

  const sortedTags = $derived(sortTags(tags));

  function applyTag(tag: Tag) {
    if (!editor) return;
    const currentText = editor.getText();
    const prefix =
      currentText.length > 0 && !currentText.endsWith("\n") ? "\n" : "";
    const textToInsert = prefix + tag.value + "\n";
    editor.chain().focus().insertContent(textToInsert).run();
  }

  async function handleDelete(event: MouseEvent, id: string) {
    event.stopPropagation();
    const tag = tags.find((t) => t.id === id);
    if (!tag) return;
    const confirmed = await requestConfirm({
      title: "Удалить тег?",
      message: `Тег «${tag.name}» будет удалён.\nЭто действие нельзя отменить.`,
      confirmText: "Удалить",
      cancelText: "Отмена",
      danger: true,
    });
    if (!confirmed) return;
    removeTag(id);
    refreshTags();
    tagsVersion.update((v) => v + 1);
  }

  function handleCreate(name: string, value: string) {
    addTag(name, value);
    refreshTags();
    tagsVersion.update((v) => v + 1);
  }

  function handleEdit(event: MouseEvent, tag: Tag) {
    event.stopPropagation();
    editingTag = tag;
    isCreateModalOpen = true;
  }

  function handleUpdate(id: string, name: string, value: string) {
    updateTag(id, name, value);
    refreshTags();
    tagsVersion.update((v) => v + 1);
  }

  function handleCloseModal() {
    isCreateModalOpen = false;
    editingTag = null;
    refreshTags();
  }
</script>

<div class="mt-4 flex flex-wrap items-center gap-2">
  {#each sortedTags as tag (tag.id)}
    <div
      class="group inline-flex select-none items-center gap-1 rounded-[5px] border px-3 py-1.5 text-xs font-medium transition-all {tag.favorite
        ? 'border-[var(--accent)]/50 bg-[var(--accent-dim)] text-[var(--text-primary)] hover:border-[var(--accent-hover)]'
        : 'border-[var(--border)] bg-[var(--bg-light)] text-[var(--text-secondary)] hover:border-[var(--accent)]/50 hover:bg-[var(--bg-lighter)] hover:text-[var(--text-primary)]'}"
    >
      {#if tag.favorite}
        <Star
          size={11}
          class="shrink-0 fill-[var(--accent)] text-[var(--accent)]"
        />
      {/if}
      <button
        type="button"
        onclick={() => applyTag(tag)}
        class="max-w-44 flex-1 truncate text-left"
        title="Клик — добавить инструкцию в промпт"
        aria-label="Добавить тег {tag.name} в промпт"
      >
        {tag.name}
      </button>
      <button
        type="button"
        onclick={(event) => handleEdit(event, tag)}
        class="rounded p-0.5 leading-none text-[var(--text-tertiary)] transition-colors hover:bg-[var(--bg-lighter)] hover:text-[var(--accent)] group-hover:text-[var(--text-secondary)]"
        aria-label="Редактировать тег {tag.name}"
      >
        <Pencil size={12} />
      </button>
    </div>
  {/each}

  <button
    type="button"
    onclick={() => (isCreateModalOpen = true)}
    class="inline-flex items-center gap-1.5 rounded-[5px] border border-dashed border-[var(--border-light)] px-3 py-1.5 text-xs font-medium text-[var(--text-tertiary)] transition-all hover:border-[var(--accent)]/60 hover:bg-[var(--accent-dim)] hover:text-[var(--accent)]"
  >
    <Plus size={14} />
    Новый тег
  </button>
</div>

<TagCreateModal
  isOpen={isCreateModalOpen}
  onClose={handleCloseModal}
  onCreate={handleCreate}
  onUpdate={handleUpdate}
  {editingTag}
/>
