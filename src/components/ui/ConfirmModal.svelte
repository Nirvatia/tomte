<script lang="ts">
  import ModalShell from "./ModalShell.svelte";
  import { t } from "$lib/i18n";
  import { CircleAlert, HelpCircle } from "@lucide/svelte";
  import { confirmState, closeConfirm } from "../../stores/confirm";
  import { autofocus } from "$lib/actions/autofocus";

  // Escape и клик мимо — отказ; у одиночного уведомления (без «Отмены») — «ОК».
  function dismiss() {
    closeConfirm($confirmState.hideCancel ? true : false);
  }
</script>

{#if $confirmState.open}
  <ModalShell
    label={$confirmState.title || $t("confirm.dialog")}
    onClose={dismiss}
    role="alertdialog"
    width="max-w-md"
    panelClass="relative p-6"
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
          {$confirmState.title || $t("confirm.title")}
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
        <!-- Для опасного действия фокус на «Отмене»: Enter не удалит случайно. -->
        <button
          type="button"
          use:autofocus={$confirmState.danger}
          onclick={() => closeConfirm(false)}
          class="btn btn-outline btn-md"
        >
          {$confirmState.cancelText || $t("common.cancel")}
        </button>
      {/if}
      <button
        type="button"
        use:autofocus={!$confirmState.danger || $confirmState.hideCancel}
        onclick={() => closeConfirm(true)}
        class="btn {$confirmState.danger ? 'btn-danger' : 'btn-primary'} btn-md"
      >
        {$confirmState.confirmText || $t("confirm.ok")}
      </button>
    </div>
  </ModalShell>
{/if}
