<script lang="ts">
  import { X } from "@lucide/svelte";

  let {
    isOpen = false,
    onClose = () => {},
    onCreate = (name: string, value: string) => {},
  }: {
    isOpen?: boolean;
    onClose?: () => void;
    onCreate?: (name: string, value: string) => void;
  } = $props();

  let tagName = $state("");
  let tagValue = $state("");
  let nameInput: HTMLInputElement;

  $effect(() => {
    if (isOpen) {
      tagName = "";
      tagValue = "";
      setTimeout(() => nameInput?.focus(), 50);
    }
  });

  function handleSubmit() {
    if (!tagName.trim() || !tagValue.trim()) return;
    onCreate(tagName.trim(), tagValue.trim());
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

  // ✅ <svelte:window> на верхнем уровне, проверяем isOpen внутри
  function handleKeydown(e: KeyboardEvent) {
    if (!isOpen) return; // Игнорируем, если модалка закрыта
    if (e.key === "Escape") {
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

<!-- ✅ <svelte:window> на верхнем уровне компонента -->
<svelte:window onkeydown={handleKeydown} />

{#if isOpen}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in"
    onclick={handleBackdropClick}
  >
    <div
      class="bg-surface rounded-2xl shadow-2xl max-w-lg w-full flex flex-col"
    >
      <!-- Заголовок -->
      <div
        class="flex items-center justify-between p-6 border-b border-slate-100"
      >
        <h2 class="text-lg font-bold text-ink">Новый тег</h2>
        <button
          onclick={handleClose}
          class="p-2 rounded-lg hover:bg-surface-tertiary text-ink-secondary hover:text-ink transition-colors"
          aria-label="Закрыть"
        >
          <X size={20} />
        </button>
      </div>

      <!-- Форма -->
      <div class="p-6 space-y-4">
        <div>
          <label for="tag-name" class="block text-sm font-medium text-ink mb-2">
            Название
          </label>
          <input
            bind:this={nameInput}
            bind:value={tagName}
            onkeydown={handleNameKeydown}
            id="tag-name"
            type="text"
            placeholder="Например: + Без тестов"
            class="w-full px-4 py-2.5 bg-surface-secondary border border-slate-200 rounded-lg text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-all"
            maxlength="50"
          />
          <p class="mt-1.5 text-xs text-ink-tertiary">
            Короткое название для кнопки (макс. 50 символов)
          </p>
        </div>

        <div>
          <label
            for="tag-value"
            class="block text-sm font-medium text-ink mb-2"
          >
            Текст инструкции
          </label>
          <textarea
            bind:value={tagValue}
            id="tag-value"
            placeholder="Введите полный текст инструкции, который будет вставляться в промпт..."
            rows="6"
            class="w-full px-4 py-2.5 bg-surface-secondary border border-slate-200 rounded-lg text-sm text-ink font-mono focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-all resize-none"
            maxlength="5000"
          ></textarea>
          <p class="mt-1.5 text-xs text-ink-tertiary">
            Этот текст будет вставлен в редактор при клике на тег (макс. 5000
            символов)
          </p>
        </div>
      </div>

      <!-- Кнопки -->
      <div
        class="flex gap-3 justify-end p-6 border-t border-slate-100 bg-surface-secondary rounded-b-2xl"
      >
        <button
          type="button"
          onclick={handleClose}
          class="px-4 py-2 text-sm font-medium rounded-lg bg-surface-tertiary text-ink-secondary hover:bg-slate-200 transition-colors"
        >
          Отмена
        </button>
        <button
          type="button"
          onclick={handleSubmit}
          disabled={!tagName.trim() || !tagValue.trim()}
          class="px-4 py-2 text-sm font-medium rounded-lg bg-brand-500 text-white hover:bg-brand-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Создать
        </button>
      </div>
    </div>
  </div>
{/if}
