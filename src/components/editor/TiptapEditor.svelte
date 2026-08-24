<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { Editor } from "@tiptap/core";

  import { buildExtensions } from "../../lib/tiptap/config";

  interface Props {
    content?: string;
    editable?: boolean;
    onReady?: (editor: Editor) => void;
    onUpdate?: (data: {
      html: string;
      text: string;
      charCount: number;
    }) => void;
  }

  let {
    content = "",
    editable = true,
    onReady = () => {},
    onUpdate = () => {},
  }: Props = $props();

  let editor: Editor | null = $state(null);
  let editorElement: HTMLDivElement;

  let isProgrammaticUpdate = false;

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
      },
      onUpdate: ({ editor: currentEditor }) => {
        if (isProgrammaticUpdate) return;
        onUpdate({
          html: currentEditor.getHTML(),
          text: currentEditor.getText(),
          charCount: currentEditor.storage.characterCount.characters(),
        });
      },
    });

    onReady(editor);
  });

  onDestroy(() => {
    editor?.destroy();
  });

  $effect(() => {
    if (editor && content !== editor.getHTML()) {
      isProgrammaticUpdate = true;
      editor.commands.setContent(content);
      isProgrammaticUpdate = false;
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
