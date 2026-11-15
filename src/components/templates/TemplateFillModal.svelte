<script lang="ts">
  import { t } from "$lib/i18n";

  import ModalShell from "../ui/ModalShell.svelte";
  import { autofocus } from "$lib/actions/autofocus";

  /**
   * Этап 10.2. Форма заполнения переменных шаблона перед экспортом.
   * Показывается, когда в тексте промпта нашлись {{name}}.
   */
  interface Props {
    variables: string[];
    /** Ранее введённые в этой сессии значения — предзаполняем ими. */
    initial: Record<string, string>;
    onSubmit: (values: Record<string, string>) => void;
    onCancel: () => void;
  }

  let { variables, initial, onSubmit, onCancel }: Props = $props();

  // Модалка создаётся заново на каждый экспорт: исходные значения — из
  // initial (запомненные ранее в сессии), правки пользователя лежат в edits.
  let edits = $state<Record<string, string>>({});
  let values = $derived<Record<string, string>>({ ...initial, ...edits });

  // {{name}} строкой: в разметке фигурные скобки напрямую не писать.
  const variableLabel = (name: string): string => "{{" + name + "}}";

  function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    onSubmit(values);
  }
</script>

<ModalShell label={$t("templates.title")} onClose={onCancel} width="max-w-md">
  <form onsubmit={handleSubmit} class="p-6">
    <p class="text-sm text-[var(--text-secondary)]">
      {$t("templates.hint")}
    </p>

    <div class="mt-4 space-y-3">
      {#each variables as name, index (name)}
        <label class="block">
          <span
            class="mb-1.5 block font-mono text-[12px] text-[var(--text-secondary)]"
          >
            <span class="chip accent">{variableLabel(name)}</span>
          </span>
          <input
            type="text"
            class="input w-full px-3"
            value={values[name] ?? ""}
            oninput={(event) => {
              edits = { ...edits, [name]: event.currentTarget.value };
            }}
            placeholder={$t("templates.valuePlaceholder")}
            maxlength="5000"
            use:autofocus={index === 0}
          />
        </label>
      {/each}
    </div>

    <div class="mt-6 flex justify-end gap-2">
      <button type="button" class="btn btn-outline btn-md" onclick={onCancel}>
        {$t("common.cancel")}
      </button>
      <button type="submit" class="btn btn-primary btn-md">
        {$t("templates.export")}
      </button>
    </div>
  </form>
</ModalShell>
