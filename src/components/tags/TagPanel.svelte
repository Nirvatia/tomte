<script lang="ts">
  import { Plus, X, Pencil } from "@lucide/svelte";
  import type { Tag } from "../../types";
  import { loadTags, addTag, removeTag, updateTag } from "../../utils/tags";
  import TagCreateModal from "./TagCreateModal.svelte";
  import type { Editor } from "@tiptap/core";
  

  let { editor = null }: { editor?: Editor | null } = $props();

  let tags = $state<Tag[]>(loadTags());
  let isCreateModalOpen = $state(false);
  let editingTag = $state<Tag | null>(null);

  function refreshTags() {
    tags = loadTags();
  }

  function applyTag(tag: Tag) {
    if (!editor) return;

    const currentText = editor.getText();
    const prefix =
      currentText.length > 0 && !currentText.endsWith("\n") ? "\n" : "";
    const textToInsert = prefix + tag.value + "\n";

    editor.chain().focus().insertContent(textToInsert).run();
  }

  function handleDelete(e: MouseEvent, id: string) {
    e.stopPropagation();
    const tag = tags.find((t) => t.id === id);
    if (!tag) return;

    if (confirm(`Удалить тег "${tag.name}"?`)) {
      removeTag(id);
      refreshTags();
    }
  }

  function handleCreate(name: string, value: string) {
    addTag(name, value);
    refreshTags();
  }
  function handleEdit(e: MouseEvent, tag: Tag) {
  e.stopPropagation();
  editingTag = tag;
  isCreateModalOpen = true;
}

function handleUpdate(id: string, name: string, value: string) {
  updateTag(id, name, value);
  refreshTags();
}

function handleCloseModal() {
  isCreateModalOpen = false;
  editingTag = null;
}
</script>

<div class="mt-4 flex flex-wrap items-center gap-2">
  <!-- Теги -->
  {#each tags as tag (tag.id)}
    <button
      type="button"
      onclick={() => applyTag(tag)}
      class="group inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-surface-tertiary border border-slate-200 text-ink-secondary hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 transition-all cursor-pointer select-none"
      title="Клик — добавить инструкцию в промпт"
    >

<span class="max-w-45 truncate">{tag.name}</span>

<span
  onclick={(e) => handleEdit(e, tag)}
  class="ml-1 text-slate-400 hover:text-brand-500 leading-none p-0.5 rounded hover:bg-brand-50 transition-colors"
  role="button"
  aria-label="Редактировать тег {tag.name}"
>
  <Pencil size={12} />
</span>

      <span
        onclick={(e) => handleDelete(e, tag.id)}
        class="ml-1 text-slate-400 hover:text-red-500 font-bold leading-none p-0.5 rounded hover:bg-red-50 transition-colors"
        role="button"
        aria-label="Удалить тег {tag.name}"
      >
        <X size={12} />
      </span>
    </button>
  {/each}

  <!-- Кнопка добавления -->
  <button
    type="button"
    onclick={() => (isCreateModalOpen = true)}
    class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-dashed border-brand-300 text-brand-600 hover:bg-brand-50 transition-all cursor-pointer"
  >
    <Plus size={14} />
    Новый тег
  </button>
</div>

<!-- Модальное окно создания тега -->
<TagCreateModal
  isOpen={isCreateModalOpen}
  onClose={handleCloseModal}
  onCreate={handleCreate}
  onUpdate={handleUpdate}
  editingTag={editingTag}
/>
