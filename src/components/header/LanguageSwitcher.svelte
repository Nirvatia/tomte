<script lang="ts">
  import { Check, Languages } from "@lucide/svelte";

  import Dropdown from "../ui/Dropdown.svelte";

  import { LOCALES, locale, t } from "$lib/i18n";
</script>

<!-- Кастомный dropdown (этап 8): в теме, единый с остальными меню. -->
<Dropdown
  label={$t("settings.language")}
  widthClass="w-36"
  align="right"
  triggerClass="h-7 text-xs"
>
  {#snippet trigger()}
    <Languages
      size={14}
      class="text-[var(--text-tertiary)]"
      aria-hidden="true"
    />
    <span>{$locale.toUpperCase()}</span>
  {/snippet}

  {#each LOCALES as option (option.id)}
    <button
      type="button"
      role="menuitem"
      class="menu-item"
      aria-current={$locale === option.id}
      onclick={() => locale.set(option.id)}
    >
      <span class="flex-1">{option.label}</span>
      {#if $locale === option.id}
        <Check size={14} class="text-[var(--accent)]" aria-hidden="true" />
      {/if}
    </button>
  {/each}
</Dropdown>
