<script lang="ts">
  import { Check, Monitor, Moon, Sun } from "@lucide/svelte";

  import Dropdown from "../ui/Dropdown.svelte";

  import { t } from "$lib/i18n";
  import type { MessageKey } from "$lib/i18n/types";
  import {
    THEME_PREFERENCES,
    theme,
    themePreference,
    type ThemePreference,
  } from "$lib/theme";

  const ICONS = { system: Monitor, light: Sun, dark: Moon };

  const label = (option: ThemePreference) =>
    $t(`theme.${option}` as MessageKey);

  // На кнопке — применённая тема: «как в системе» показывает солнце или луну.
  const CurrentIcon = $derived(ICONS[$theme]);
</script>

<!-- Рядом с выбором языка: тот же dropdown дизайн-системы. -->
<Dropdown
  label={$t("theme.label")}
  widthClass="w-44"
  align="right"
  triggerClass="h-7"
>
  {#snippet trigger()}
    <CurrentIcon
      size={15}
      class="text-[var(--text-secondary)]"
      aria-hidden="true"
    />
  {/snippet}

  {#each THEME_PREFERENCES as option (option)}
    {@const Icon = ICONS[option]}
    <button
      type="button"
      role="menuitem"
      class="menu-item"
      aria-current={$themePreference === option}
      onclick={() => themePreference.set(option)}
    >
      <Icon size={14} class="shrink-0" aria-hidden="true" />
      <span class="flex-1">{label(option)}</span>
      {#if $themePreference === option}
        <Check size={14} class="text-[var(--accent)]" aria-hidden="true" />
      {/if}
    </button>
  {/each}
</Dropdown>
