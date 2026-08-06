<!-- TagPanel.svelte -->
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
      class="group inline-flex select-none items-center gap-1 rounded-lg border border-line bg-raised px-3 py-1.5 text-xs font-medium text-txt2 transition-all hover:border-amb/50 hover:bg-raised2 hover:text-txt"
    >
      <!-- Кнопка применения тега -->
      <button
        type="button"
        onclick={() => applyTag(tag)}
        class="max-w-44 flex-1 truncate text-left"
        title="Клик — добавить инструкцию в промпт"
        aria-label="Добавить тег {tag.name} в промпт"
      >
        {tag.name}
      </button>
      <!-- Кнопка редактирования -->
      <button
        type="button"
        onclick={(e) => handleEdit(e, tag)}
        class="rounded p-0.5 leading-none text-txt3 transition-colors hover:bg-raised hover:text-amb group-hover:text-txt2"
        aria-label="Редактировать тег {tag.name}"
      >
        <Pencil size={12} />
      </button>
      <!-- Кнопка удаления -->
      <button
        type="button"
        onclick={(e) => handleDelete(e, tag.id)}
        class="rounded p-0.5 font-bold leading-none text-txt3 transition-colors hover:bg-red-50 hover:text-red-600 group-hover:text-txt2"
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
    class="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-line2 px-3 py-1.5 text-xs font-medium text-txt3 transition-all hover:border-amb/60 hover:bg-amb/10 hover:text-amb"
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