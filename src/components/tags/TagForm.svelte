<script lang="ts">
  import { t } from "$lib/i18n";

  import { autofocus } from "$lib/actions/autofocus";

  /**
   * Форма тега: имя и текст (этап 15.2). Общая для модалки «Новый тег»
   * под редактором и для формы в менеджере тегов — раньше это были две
   * копии одной разметки. Enter в поле имени сохраняет.
   */
  interface Props {
    initialName?: string;
    initialValue?: string;
    isEditing?: boolean;
    /** Высота поля текста в строках. */
    rows?: number;
    onSubmit: (name: string, value: string) => void;
    onCancel: () => void;
  }

  let {
    initialName = "",
    initialValue = "",
    isEditing = false,
    rows = 6,
    onSubmit,
    onCancel,
  }: Props = $props();

  // Начальные значения формы: правка начинается с того, что было.
  // svelte-ignore state_referenced_locally
  let name = $state(initialName);
  // svelte-ignore state_referenced_locally
  let value = $state(initialValue);

  const uid = $props.id();
  const canSubmit = $derived(Boolean(name.trim() && value.trim()));

  function submit() {
    if (canSubmit) onSubmit(name.trim(), value.trim());
  }

  const LABEL =
    "mb-2 block font-mono text-caption font-semibold uppercase tracking-wider text-[var(--text-tertiary)]";
</script>

<div class="space-y-4 overflow-y-auto p-6">
  <div>
    <label for="{uid}-name" class={LABEL}>{$t("tags.name")}</label>
    <input
      use:autofocus
      bind:value={name}
      onkeydown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          submit();
        }
      }}
      id="{uid}-name"
      type="text"
      placeholder={$t("tags.namePlaceholder")}
      class="input w-full"
      maxlength="50"
    />
    <p class="mt-1.5 text-xs text-[var(--text-tertiary)]">
      {$t("tags.nameHint")}
    </p>
  </div>
  <div>
    <label for="{uid}-value" class={LABEL}>{$t("tags.value")}</label>
    <textarea
      bind:value
      id="{uid}-value"
      placeholder={$t("tags.valuePlaceholder")}
      {rows}
      class="input w-full resize-none font-mono"
      maxlength="5000"></textarea>
    <p class="mt-1.5 text-xs text-[var(--text-tertiary)]">
      {$t("tags.valueHint")}
    </p>
  </div>
</div>

<div
  class="flex justify-end gap-3 rounded-b-xl border-t border-[var(--border)] bg-[var(--bg-medium)] p-5"
>
  <button type="button" onclick={onCancel} class="btn btn-outline btn-md">
    {$t("common.cancel")}
  </button>
  <button
    type="button"
    onclick={submit}
    disabled={!canSubmit}
    class="btn btn-primary btn-md"
  >
    {isEditing ? $t("common.save") : $t("common.create")}
  </button>
</div>
