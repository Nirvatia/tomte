<script lang="ts">
  import { t } from "$lib/i18n";
  import { X } from "@lucide/svelte";

  import type { Tag } from "../../types";
  import ModalShell from "../ui/ModalShell.svelte";
  import TagForm from "./TagForm.svelte";

  /** Модалка «Новый тег» / «Изменить тег» под редактором. */
  interface Props {
    isOpen?: boolean;
    onClose?: () => void;
    onCreate?: (name: string, value: string) => void;
    onUpdate?: (id: string, name: string, value: string) => void;
    editingTag?: Tag | null;
  }

  let {
    isOpen = false,
    onClose = () => {},
    onCreate = () => {},
    onUpdate = () => {},
    editingTag = null,
  }: Props = $props();

  const title = $derived(editingTag ? $t("tags.editTitle") : $t("tags.new"));

  function handleSubmit(name: string, value: string) {
    if (editingTag) {
      onUpdate(editingTag.id, name, value);
    } else {
      onCreate(name, value);
    }
    onClose();
  }
</script>

{#if isOpen}
  <ModalShell
    label={title}
    {onClose}
    width="max-w-lg"
    panelClass="flex flex-col"
  >
    <div
      class="flex items-center justify-between border-b border-[var(--border)] p-5"
    >
      <h2 class="text-lg font-bold text-[var(--text-primary)]">{title}</h2>
      <button
        type="button"
        onclick={onClose}
        class="icon-btn"
        aria-label={$t("common.close")}
      >
        <X size={20} />
      </button>
    </div>
    <!-- key: при смене редактируемого тега форма начинается заново. -->
    {#key editingTag?.id}
      <TagForm
        initialName={editingTag?.name}
        initialValue={editingTag?.value}
        isEditing={Boolean(editingTag)}
        onSubmit={handleSubmit}
        onCancel={onClose}
      />
    {/key}
  </ModalShell>
{/if}
