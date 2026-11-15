<script lang="ts">
  import type { Snippet } from "svelte";

  /**
   * Квадратная кнопка под иконку 28px (этап 8).
   * aria-label обязателен: кнопка без текста.
   */
  interface Props {
    label: string;
    danger?: boolean;
    disabled?: boolean;
    onclick?: (event: MouseEvent) => void;
    children: Snippet;
  }

  let {
    label,
    danger = false,
    disabled = false,
    onclick,
    children,
  }: Props = $props();
</script>

<button
  type="button"
  class="icon-btn"
  class:danger
  aria-label={label}
  title={label}
  {disabled}
  {onclick}
>
  {@render children()}
</button>
