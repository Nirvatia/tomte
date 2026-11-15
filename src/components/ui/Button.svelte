<script lang="ts">
  import type { Snippet } from "svelte";

  /**
   * Единая кнопка (этап 8). Варианты и размеры — классы из app.css,
   * чтобы не собирать их вручную в каждом файле.
   */
  interface Props {
    variant?: "primary" | "ghost" | "outline" | "danger";
    size?: "sm" | "md";
    type?: "button" | "submit";
    disabled?: boolean;
    loading?: boolean;
    title?: string;
    /** Перекрывает текст детей для aria-label (иконка + текст). */
    ariaLabel?: string;
    onclick?: (event: MouseEvent) => void;
    children: Snippet;
  }

  let {
    variant = "primary",
    size = "md",
    type = "button",
    disabled = false,
    loading = false,
    title,
    ariaLabel,
    onclick,
    children,
  }: Props = $props();
</script>

<button
  {type}
  class="btn btn-{variant} btn-{size}"
  disabled={disabled || loading}
  {title}
  aria-label={ariaLabel}
  aria-busy={loading}
  {onclick}
>
  {#if loading}<span class="btn-spinner" aria-hidden="true"></span>{/if}
  {@render children()}
</button>
