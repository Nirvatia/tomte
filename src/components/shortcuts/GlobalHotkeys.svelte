<script lang="ts">
  import { get } from "svelte/store";

  import { findHotkey, type HotkeyId } from "$lib/hotkeys";
  import {
    activeFileId,
    isExportMenuOpen,
    isQuickOpenOpen,
    isShortcutsOpen,
  } from "../../stores";
  import {
    activateAdjacentTab,
    closePromptFileTab,
    createPromptFile,
    flushPendingEditorSave,
  } from "../../utils/projectActions";

  const actions: Record<HotkeyId, () => void> = {
    save: () => void flushPendingEditorSave(),
    newFile: () => void createPromptFile(),
    closeTab: () => {
      const id = get(activeFileId);
      if (id) void closePromptFileTab(id);
    },
    quickOpen: () => isQuickOpenOpen.set(true),
    export: () => isExportMenuOpen.set(true),
    nextTab: () => void activateAdjacentTab(1),
    prevTab: () => void activateAdjacentTab(-1),
    help: () => isShortcutsOpen.set(true),
  };

  function handleKeydown(event: KeyboardEvent) {
    if (event.defaultPrevented || event.isComposing) return;
    const hotkey = findHotkey(event);
    if (!hotkey) return;
    // Пока открыта модалка, клавиши принадлежат ей. Ctrl+S гасим всегда:
    // браузерное «Сохранить страницу как» здесь не нужно никогда.
    if (hotkey.id !== "save" && document.querySelector('[aria-modal="true"]'))
      return;
    event.preventDefault();
    actions[hotkey.id]();
  }
</script>

<svelte:window onkeydown={handleKeydown} />
