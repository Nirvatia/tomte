<!-- TagCreateModal.svelte -->
<script lang="ts">
  import type { Tag } from "../../types";
  import { X } from "@lucide/svelte";
  let {
    isOpen = false,
    onClose = () => {},
    onCreate = (name: string, value: string) => {},
    onUpdate = (id: string, name: string, value: string) => {},
    editingTag = null as Tag | null,
  }: {
    isOpen?: boolean;
    onClose?: () => void;
    onCreate?: (name: string, value: string) => void;
    onUpdate?: (id: string, name: string, value: string) => void;
    editingTag?: Tag | null;
  } = $props();
  let tagName = $state("");
  let tagValue = $state("");
  let nameInput: HTMLInputElement | null = $state(null);
  $effect(() => {
    if (isOpen) {
      if (editingTag) {
        tagName = editingTag.name;
        tagValue = editingTag.value;
      } else {
        tagName = "";
        tagValue = "";
      }
      setTimeout(() => nameInput?.focus(), 50);
    }
  });
  function handleSubmit() {
    if (!tagName.trim() || !tagValue.trim()) return;
    if (editingTag) {
      onUpdate(editingTag.id, tagName.trim(), tagValue.trim());
    } else {
      onCreate(tagName.trim(), tagValue.trim());
    }
    handleClose();
  }
  function handleClose() {
    tagName = "";
    tagValue = "";
    onClose();
  }
  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  }
  function handleBackdropKeydown(e: KeyboardEvent) {
    if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      handleClose();
    }
  }
  function handleWindowKeydown(e: KeyboardEvent) {
    if (e.key === "Escape" && isOpen) {
      handleClose();
    }
  }
  function handleNameKeydown(e: KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
  }
</script>

<svelte:window onkeydown={handleWindowKeydown} />

{#if isOpen}
  <div
    class="fixed inset-0 z-50 flex animate-fade-in items-center justify-center bg-black/60 p-4 backdrop-blur-[2px]"
    role="button"
    tabindex="0"
    onclick={handleBackdropClick}
    onkeydown={handleBackdropKeydown}
    aria-label="Закрыть окно тега"
  >
    <div
      class="flex w-full max-w-lg flex-col rounded-xl border border-line2 bg-panel shadow-deep"
      role="presentation"
      onclick={(e) => e.stopPropagation()}
    >
      <!-- Заголовок -->
      <div class="flex items-center justify-between border-b border-line p-5">
        <h2 class="text-lg font-bold text-txt">
          {editingTag ? "Редактировать тег" : "Новый тег"}
        </h2>
        <button
          type="button"
          onclick={handleClose}
          class="rounded-lg p-2 text-txt2 transition-colors hover:bg-raised2 hover:text-txt"
          aria-label="Закрыть"
        >
          <X size={20} />
        </button>
      </div>

      <!-- Форма -->
      <div class="space-y-4 p-6">
        <div>
          <label
            for="tag-name"
            class="mb-2 block font-mono text-[11px] font-semibold uppercase tracking-wider text-txt3"
          >
            Название
          </label>
          <input
            bind:this={nameInput}
            bind:value={tagName}
            onkeydown={handleNameKeydown}
            id="tag-name"
            type="text"
            placeholder="Например: + Без тестов"
            class="w-full rounded-md border border-line bg-inset px-3.5 py-2.5 text-sm text-txt transition-all placeholder:text-txt3 focus:border-amb/60 focus:outline-none focus:ring-2 focus:ring-amb/15"
            maxlength="50"
          />
          <p class="mt-1.5 text-xs text-txt3">
            Короткое название для кнопки (макс. 50 символов)
          </p>
        </div>

        <div>
          <label
            for="tag-value"
            class="mb-2 block font-mono text-[11px] font-semibold uppercase tracking-wider text-txt3"
          >
            Текст инструкции
          </label>
          <textarea
            bind:value={tagValue}
            id="tag-value"
            placeholder="Введите полный текст инструкции, который будет вставляться в промпт..."
            rows="6"
            class="w-full resize-none rounded-md border border-line bg-inset px-3.5 py-2.5 font-mono text-sm text-txt transition-all placeholder:text-txt3 focus:border-amb/60 focus:outline-none focus:ring-2 focus:ring-amb/15"
            maxlength="5000"
          ></textarea>
          <p class="mt-1.5 text-xs text-txt3">
            Этот текст будет вставлен в редактор при клике на тег (макс. 5000
            символов)
          </p>
        </div>
      </div>

      <!-- Кнопки -->
      <div
        class="flex justify-end gap-3 rounded-b-xl border-t border-line bg-raised p-5"
      >
        <button
          type="button"
          onclick={handleClose}
          class="rounded-md bg-raised2 px-4 py-2 text-sm font-medium text-txt2 transition-colors hover:bg-[#383a41] hover:text-txt"
        >
          Отмена
        </button>
        <button
          type="button"
          onclick={handleSubmit}
          disabled={!tagName.trim() || !tagValue.trim()}
          class="rounded-md bg-amb px-4 py-2 text-sm font-semibold text-[#16130c] transition-colors hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {editingTag ? "Сохранить" : "Создать"}
        </button>
      </div>
    </div>
  </div>
{/if}
