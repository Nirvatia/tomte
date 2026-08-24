<script lang="ts">
  import { X } from "@lucide/svelte";

  import type { Tag } from "../../types";

  interface Props {
    isOpen?: boolean;
    onClose?: () => void;
    onCreate?: (name: string, value: string) => void;
    onUpdate?: (id: string, name: string, value: string) => void;
    editingTag?: Tag | null;
  }

  let {
    isOpen = false,
    onClose = () => {},
    onCreate = () => {},
    onUpdate = () => {},
    editingTag = null,
  }: Props = $props();

  let tagName = $state("");
  let tagValue = $state("");
  let nameInput = $state<HTMLInputElement | null>(null);

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

  function handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      handleClose();
    }
  }

  function handleBackdropKeydown(event: KeyboardEvent) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
    }
    if (event.key === "Escape") {
      handleClose();
    }
  }

  function handleWindowKeydown(event: KeyboardEvent) {
    if (event.key === "Escape" && isOpen) {
      handleClose();
    }
  }

  function handleNameKeydown(event: KeyboardEvent) {
    if (event.key === "Enter") {
      event.preventDefault();
      handleSubmit();
    }
  }
</script>

<svelte:window onkeydown={handleWindowKeydown} />

{#if isOpen}
  <div
    class="fixed inset-0 z-50 flex animate-fade-in items-center justify-center bg-black/60 p-4 backdrop-blur-[2px]"
    onclick={handleBackdropClick}
    onkeydown={handleBackdropKeydown}
    role="button"
    tabindex="0"
    aria-label="Закрыть окно тега"
  >
    <div
      class="flex w-full max-w-lg flex-col rounded-xl border border-[var(--border-light)] bg-[var(--bg-dark)] shadow-[var(--shadow-lg)]"
      role="presentation"
      onclick={(event) => event.stopPropagation()}
      onkeydown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
        }
      }}
    >
      <div
        class="flex items-center justify-between border-b border-[var(--border)] p-5"
      >
        <h2 class="text-lg font-bold text-[var(--text-primary)]">
          {editingTag ? "Редактировать тег" : "Новый тег"}
        </h2>
        <button
          type="button"
          onclick={handleClose}
          class="rounded-lg p-2 text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-lighter)] hover:text-[var(--text-primary)]"
          aria-label="Закрыть"
        >
          <X size={20} />
        </button>
      </div>

      <div class="space-y-4 p-6">
        <div>
          <label
            for="tag-name"
            class="mb-2 block font-mono text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]"
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
            bind:value={tagValue}
            id="tag-value"
            placeholder="Введите полный текст инструкции, который будет вставляться в промпт..."
            rows="6"
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
          onclick={handleClose}
          class="rounded-md bg-[var(--bg-lighter)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-light)] hover:text-[var(--text-primary)]"
        >
          Отмена
        </button>
        <button
          type="button"
          onclick={handleSubmit}
          disabled={!tagName.trim() || !tagValue.trim()}
          class="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--bg-darkest)] transition-colors hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {editingTag ? "Сохранить" : "Создать"}
        </button>
      </div>
    </div>
  </div>
{/if}
