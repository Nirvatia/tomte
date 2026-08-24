<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    checked?: boolean;
    indeterminate?: boolean;
    disabled?: boolean;
    ariaLabel?: string;
    onToggle?: (event: Event) => void;
    children?: Snippet;
  }

  let {
    checked = false,
    indeterminate = false,
    disabled = false,
    ariaLabel = "",
    onToggle,
    children,
  }: Props = $props();

  let input = $state<HTMLInputElement | null>(null);

  $effect(() => {
    if (input) {
      input.indeterminate = indeterminate;
    }
  });

  function handleChange(event: Event) {
    if (disabled) {
      event.preventDefault();
      return;
    }
    if (onToggle) {
      onToggle(event);
    }
  }
</script>

<label
  class="checkbox-wrapper {disabled ? 'checkbox-disabled' : ''}"
  aria-disabled={disabled}
>
  <input
    bind:this={input}
    type="checkbox"
    {checked}
    {disabled}
    aria-label={ariaLabel || undefined}
    class="checkbox-input"
    onclick={handleChange}
  />
  <span class="checkbox-visual" aria-hidden="true">
    {#if indeterminate}
      <svg
        class="checkbox-icon"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        stroke-width="3"
        stroke-linecap="round"
      >
        <line x1="4" y1="8" x2="12" y2="8" />
      </svg>
    {:else if checked}
      <svg
        class="checkbox-icon"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        stroke-width="3"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <polyline points="3.5 8.5 6.5 11.5 12.5 4.5" />
      </svg>
    {/if}
  </span>
  {#if children}
    <span class="checkbox-label">
      {@render children()}
    </span>
  {/if}
</label>
