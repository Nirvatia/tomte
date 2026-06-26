<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { Editor } from "@tiptap/core";
  import { buildExtensions } from "../../lib/tiptap/config";

  let {
    content = "",
    editable = true,
    onReady = (editor: Editor) => {},
    onUpdate = (data: { html: string; text: string; charCount: number }) => {},
  }: {
    content?: string;
    editable?: boolean;
    onReady?: (editor: Editor) => void;
    onUpdate?: (data: {
      html: string;
      text: string;
      charCount: number;
    }) => void;
  } = $props();

  let editor: Editor | null = $state(null);
  let editorElement: HTMLDivElement;

  onMount(() => {
    editor = new Editor({
      element: editorElement,
      extensions: buildExtensions(),
      content,
      editable,
      editorProps: {
        attributes: {
          class: "tiptap-prose",
          spellcheck: "true",
        },
        // Предотвращаем клик вне контента
        handleDOMEvents: {
          mousedown: (view, event) => {
            const target = event.target as HTMLElement;
            // Если клик был на самом wrapper, а не на контенте
            if (target === editorElement) {
              event.preventDefault();
              return true;
            }
            return false;
          },
        },
      },
      onUpdate: ({ editor: e }) => {
        onUpdate({
          html: e.getHTML(),
          text: e.getText(),
          charCount: e.storage.characterCount.characters(),
        });
      },
      onSelectionUpdate: ({ editor: e }) => {
        onReady(e);
      },
    });

    onReady(editor);
  });

  onDestroy(() => {
    editor?.destroy();
  });

  $effect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  });

  $effect(() => {
    if (editor && editable !== editor.isEditable) {
      editor.setEditable(editable);
    }
  });

  export function getEditor(): Editor | null {
    return editor;
  }
</script>

<div bind:this={editorElement} class="tiptap-wrapper"></div>

