<script lang="ts">
  import { get } from "svelte/store";
  import { activeProject, attachedFiles, promptFiles } from "../../stores";
  import { formatFileSize, pluralize } from "../../utils";
  import { calculateProjectSize } from "../../utils/projectDb";

  let projectSize = $state(0);
  let lastProjectId = $state<string | null>(null);

  $effect(() => {
    const project = $activeProject;
    if (!project) {
      projectSize = 0;
      lastProjectId = null;
      return;
    }
    const isNewProject = project.id !== lastProjectId;
    lastProjectId = project.id;
    if (isNewProject) {
      projectSize = calculateProjectSize(project);
      return;
    }
    const timer = setTimeout(() => {
      const currentProject = get(activeProject);
      if (currentProject) {
        projectSize = calculateProjectSize(currentProject);
      }
    }, 500);
    return () => clearTimeout(timer);
  });
</script>

<div
  class="flex h-[28px] shrink-0 items-center border-t border-[var(--border)] bg-[var(--bg-dark)] px-4 text-[12px] text-[var(--text-secondary)]"
>
  <span
    class="flex max-w-[300px] items-center gap-1.5 truncate font-medium text-[13px] text-[var(--text-secondary)]"
  >
    <span class="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]"></span>
    {$activeProject?.name ?? "—"}
  </span>

  <div class="ml-auto flex items-center gap-3">
    <span>
      {$promptFiles.length}
      {pluralize($promptFiles.length, "промпт", "промпта", "промптов")}
    </span>
    <span>·</span>
    <span>
      {$attachedFiles.length}
      {pluralize($attachedFiles.length, "вложение", "вложения", "вложений")}
    </span>
    <span>·</span>
    <span class="font-mono"
      >{formatFileSize(projectSize)}</span
    >
  </div>
</div>
