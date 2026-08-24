<script lang="ts">
  import { CircleAlert, HelpCircle } from "@lucide/svelte";
  import { confirmState, closeConfirm } from "../../stores/confirm";

  function handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      closeConfirm($confirmState.hideCancel ? true : false);
    }
  }

  function handleBackdropKeydown(event: KeyboardEvent) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
    }
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopImmediatePropagation();
      closeConfirm($confirmState.hideCancel ? true : false);
    }
  }
</script>

<svelte:window
  onkeydown={(event) => {
    if (!$confirmState.open) return;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopImmediatePropagation();
      closeConfirm($confirmState.hideCancel ? true : false);
    }
  }}
/>

{#if $confirmState.open}
  <div
    class="fixed inset-0 z-[100] flex animate-fade-in items-center justify-center bg-black/60 p-4 backdrop-blur-[2px]"
    onclick={handleBackdropClick}
    onkeydown={handleBackdropKeydown}
    role="alertdialog"
    aria-modal="true"
    aria-label={$confirmState.title || "Подтверждение действия"}
    tabindex="-1"
  >
    <div
      class="relative w-full max-w-md animate-scale-in rounded-xl border border-[var(--border-light)] bg-[var(--bg-dark)] p-6 shadow-[var(--shadow-lg)]"
      role="presentation"
      onclick={(event) => event.stopPropagation()}
      onkeydown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
        }
      }}
    >
      {#if $confirmState.danger}
        <span
          class="absolute left-0 top-6 h-9 w-0.75 rounded-r bg-[var(--error)]"
          aria-hidden="true"
        ></span>
      {:else}
        <span
          class="absolute left-0 top-6 h-9 w-0.75 rounded-r bg-[var(--accent)]"
          aria-hidden="true"
        ></span>
      {/if}
      <div class="flex items-start gap-4">
        <div
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border {$confirmState.danger
            ? 'border-[var(--error)]/40 bg-[var(--error)]/10'
            : 'border-[var(--accent)]/40 bg-[var(--accent-dim)]'}"
        >
          {#if $confirmState.danger}
            <CircleAlert size={20} class="text-[var(--error)]" />
          {:else}
            <HelpCircle size={20} class="text-[var(--accent)]" />
          {/if}
        </div>
        <div class="min-w-0 flex-1">
          <h3 class="mb-1 text-[15px] font-bold text-[var(--text-primary)]">
            {$confirmState.title || "Подтверждение"}
          </h3>
          <p
            class="whitespace-pre-wrap text-sm leading-relaxed text-[var(--text-secondary)]"
          >
            {$confirmState.message}
          </p>
        </div>
      </div>
      <div class="mt-6 flex justify-end gap-2">
        {#if !$confirmState.hideCancel}
          <button
            type="button"
            onclick={() => closeConfirm(false)}
            class="h-9 rounded-md border border-[var(--border)] px-4 text-sm font-medium text-[var(--text-secondary)] transition-all hover:bg-[var(--bg-light)] hover:text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
          >
            {$confirmState.cancelText || "Отмена"}
          </button>
        {/if}
        <button
          type="button"
          onclick={() => closeConfirm(true)}
          class="h-9 rounded-md px-4 text-sm font-semibold transition-all focus:outline-none focus:ring-2 {$confirmState.danger
            ? 'bg-[var(--error)] text-[var(--bg-darkest)] hover:bg-[var(--error)]/80 focus:ring-[var(--error)]/30'
            : 'bg-[var(--accent)] text-[var(--bg-darkest)] hover:bg-[var(--accent-hover)] focus:ring-[var(--accent)]/30'}"
        >
          {$confirmState.confirmText || "Подтвердить"}
        </button>
      </div>
    </div>
  </div>
{/if}
