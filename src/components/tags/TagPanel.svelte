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
    <!-- Используем div-контейнер вместо button, чтобы избежать вложенных интерактивных элементов -->
    <div
      class="group inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-surface-tertiary border border-slate-200 text-ink-secondary hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 transition-all select-none"
    >
      <!-- Кнопка применения тега -->
      <button
        type="button"
        onclick={() => applyTag(tag)}
        class="flex-1 text-left truncate max-w-44"
        title="Клик — добавить инструкцию в промпт"
        aria-label="Добавить тег {tag.name} в промпт"
      >
        {tag.name}
      </button>

      <!-- Кнопка редактирования -->
      <button
        type="button"
        onclick={(e) => handleEdit(e, tag)}
        class="text-slate-400 hover:text-brand-500 leading-none p-0.5 rounded hover:bg-brand-50 transition-colors"
        aria-label="Редактировать тег {tag.name}"
      >
        <Pencil size={12} />
      </button>

      <!-- Кнопка удаления -->
      <button
        type="button"
        onclick={(e) => handleDelete(e, tag.id)}
        class="text-slate-400 hover:text-red-500 font-bold leading-none p-0.5 rounded hover:bg-red-50 transition-colors"
        aria-label="Удалить тег {tag.name}"
      >
        <X size={12} />
      </button>
    </div>
  {/each}

  <!-- Кнопка добавления -->
  <button
    type="button"
    onclick={() => (isCreateModalOpen = true)}
    class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-dashed border-brand-300 text-brand-600 hover:bg-brand-50 transition-all"
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
  {editingTag}
/>
