<script lang="ts">
  import {
    Check,
    GraduationCap,
    Keyboard,
    Monitor,
    Moon,
    Settings,
    Sun,
  } from "@lucide/svelte";

  import Dropdown from "../ui/Dropdown.svelte";

  import { LOCALES, locale, t } from "$lib/i18n";
  import type { MessageKey } from "$lib/i18n/types";
  import { THEME_PREFERENCES, themePreference } from "$lib/theme";
  import { isShortcutsOpen, isTourOpen } from "../../stores";

  /**
   * Этап 14.5. Настройки в шапке — одна кнопка на всех экранах:
   * тема, язык, обучение и горячие клавиши. Раньше тема и язык были
   * отдельными кнопками, и на телефоне шапка не помещалась.
   * Тема и язык — переключатели (menuitemradio): меню остаётся открытым,
   * эффект виден сразу. Обучение и клавиши — действия, меню закрывается.
   */
  const THEME_ICONS = { system: Monitor, light: Sun, dark: Moon };
</script>

<Dropdown
  label={$t("settings.title")}
  widthClass="w-56"
  align="right"
  triggerClass="h-7"
>
  {#snippet trigger()}
    <Settings
      size={15}
      class="text-[var(--text-secondary)]"
      aria-hidden="true"
    />
  {/snippet}

  <div role="group" aria-label={$t("theme.label")}>
    <p class="menu-label">{$t("theme.label")}</p>
    {#each THEME_PREFERENCES as option (option)}
      {@const Icon = THEME_ICONS[option]}
      <button
        type="button"
        role="menuitemradio"
        aria-checked={$themePreference === option}
        class="menu-item"
        onclick={() => themePreference.set(option)}
      >
        <Icon size={14} class="shrink-0" aria-hidden="true" />
        <span class="flex-1">{$t(`theme.${option}` as MessageKey)}</span>
        {#if $themePreference === option}
          <Check size={14} class="text-[var(--accent)]" aria-hidden="true" />
        {/if}
      </button>
    {/each}
  </div>

  <div class="menu-sep"></div>

  <div role="group" aria-label={$t("settings.language")}>
    <p class="menu-label">{$t("settings.language")}</p>
    {#each LOCALES as option (option.id)}
      <button
        type="button"
        role="menuitemradio"
        aria-checked={$locale === option.id}
        class="menu-item"
        onclick={() => locale.set(option.id)}
      >
        <span
          class="w-[14px] shrink-0 font-mono text-micro font-semibold uppercase"
          aria-hidden="true">{option.id}</span
        >
        <span class="flex-1">{option.label}</span>
        {#if $locale === option.id}
          <Check size={14} class="text-[var(--accent)]" aria-hidden="true" />
        {/if}
      </button>
    {/each}
  </div>

  <div class="menu-sep"></div>

  <button
    type="button"
    role="menuitem"
    class="menu-item"
    onclick={() => isTourOpen.set(true)}
  >
    <GraduationCap size={14} class="shrink-0" aria-hidden="true" />
    <span class="flex-1">{$t("toolbar.tour")}</span>
  </button>
  <button
    type="button"
    role="menuitem"
    class="menu-item"
    onclick={() => isShortcutsOpen.set(true)}
  >
    <Keyboard size={14} class="shrink-0" aria-hidden="true" />
    <span class="flex-1">{$t("shortcuts.title")}</span>
    <kbd class="font-mono text-caption text-[var(--text-tertiary)]">?</kbd>
  </button>
</Dropdown>
