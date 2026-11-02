<script lang="ts">
  import { Languages } from "@lucide/svelte";

  import { LOCALES, locale, t, type Locale } from "$lib/i18n";
</script>

<!-- Нативный select: доступен с клавиатуры и скринридеров без доработок. -->
<label
  class="flex h-7 items-center gap-1.5 rounded-md border border-[var(--border)] px-2 text-xs text-[var(--text-secondary)] transition-colors focus-within:border-[var(--accent)] hover:border-[var(--border-light)] hover:text-[var(--text-primary)]"
  title={$t("settings.language")}
>
  <Languages size={14} aria-hidden="true" />
  <select
    value={$locale}
    onchange={(event) => locale.set(event.currentTarget.value as Locale)}
    aria-label={$t("settings.language")}
    class="cursor-pointer bg-transparent text-xs outline-none"
  >
    {#each LOCALES as option (option.id)}
      <option value={option.id} class="bg-[var(--bg-medium)]"
        >{option.label}</option
      >
    {/each}
  </select>
</label>
