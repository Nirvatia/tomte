<script lang="ts">
  import type { Snippet } from "svelte";

  /**
   * Кнопка тулбара редактора (этап 15.2). active задан — кнопка-переключатель
   * (жирный, список…): подсветка и aria-pressed для скринридера.
   */
  interface Props {
    label: string;
    /** Подсказка с горячей клавишей; по умолчанию — label. */
    hint?: string;
    active?: boolean;
    disabled?: boolean;
    /** Видимость по ширине тулбара (@2xl:flex и т. п.) и цвет наведения. */
    class?: string;
    onclick: () => void;
    children: Snippet;
  }

  let {
    label,
    hint,
    active,
    disabled = false,
    class: extraClass = "",
    onclick,
    children,
  }: Props = $props();

  // Цвета состояний не смешиваем в одной строке классов: из двух text-[...]
  // Tailwind применяет тот, что позже в CSS, а не в атрибуте. Из-за этого
  // активная кнопка раньше получала светлую иконку на бирюзовом (1.3:1).
  const BASE =
    "w-8 h-8 flex items-center justify-center rounded-md transition-all duration-150 disabled:opacity-30 disabled:cursor-not-allowed";
  const IDLE =
    "text-[var(--text-secondary)] hover:bg-[var(--bg-light)] hover:text-[var(--text-primary)]";
  const ACTIVE =
    "bg-[var(--accent)] text-[var(--bg-darkest)] hover:bg-[var(--accent-hover)]";
</script>

<button
  type="button"
  {onclick}
  {disabled}
  class="{BASE} {active ? ACTIVE : IDLE} {extraClass}"
  aria-label={label}
  aria-pressed={active === undefined ? undefined : active}
  title={hint ?? label}
>
  {@render children()}
</button>
