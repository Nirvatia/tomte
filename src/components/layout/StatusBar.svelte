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
  class="flex h-[26px] shrink-0 items-center bg-[var(--accent)] px-4 text-[12px] font-medium text-[var(--bg-darkest)]"
>
  <span class="max-w-[300px] truncate font-semibold">
    {$activeProject?.name ?? "—"}
  </span>

  <div class="ml-auto flex items-center gap-2">
    <span>
      {$promptFiles.length}
      {pluralize($promptFiles.length, "промпт", "промпта", "промптов")}
    </span>
    <span class="opacity-50">·</span>
    <span>
      {$attachedFiles.length}
      {pluralize($attachedFiles.length, "вложение", "вложения", "вложений")}
    </span>
    <span class="opacity-50">·</span>
    <span class="font-mono">{formatFileSize(projectSize)}</span>
  </div>
</div>
