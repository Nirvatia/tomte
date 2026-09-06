import { createRawSnippet } from "svelte";

/**
 * Создаёт текстовый snippet для передачи в компоненты,
 * которые ожидают children/другие Snippet-пропсы.
 *
 * Используется вместо создания .svelte-обёрток.
 */
export function createTextSnippet(text: string) {
  return createRawSnippet(() => ({
    render: () => `<span>${text}</span>`,
  }));
}