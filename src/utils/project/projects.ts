/**
 * Проекты: переключение, создание, переименование, удаление, копия.
 * Часть projectActions (этап 15.1); снаружи импортируется через него.
 */
import { translate } from "$lib/i18n";
import { get } from "svelte/store";
import type { Project } from "../../types";
import type { GithubRepoConfig } from "../github";
import { activeProject } from "../../stores";
import { decide } from "./decisions";
import {
  saveProject,
  SAVE_META,
  checkProjectSize,
  loadProject,
  deleteProject,
  loadProjectSummaries,
  createEmptyProject,
  calculateProjectSize,
} from "../projectDb";
import { applyProjectToStores, flushPendingEditorSave, nowIso } from "./core";

// ════════════════════════════════════════════
// Проекты
// ════════════════════════════════════════════

export async function switchProject(projectId: string): Promise<void> {
  await flushPendingEditorSave();
  const project = await loadProject(projectId);
  if (!project) return;
  applyProjectToStores(project);
}

export async function createNewProject(name?: string): Promise<void> {
  await flushPendingEditorSave();
  const newProject = createEmptyProject(
    name?.trim() || translate("projects.untitled"),
  );
  await saveProject(newProject);
  applyProjectToStores(newProject);
}

export async function renameProjectById(
  projectId: string,
  newName: string,
): Promise<void> {
  const trimmedName = newName.trim();
  if (!trimmedName) return;

  await flushPendingEditorSave();
  const current = get(activeProject);
  const isActive = current?.id === projectId;
  const project = isActive ? current : await loadProject(projectId);
  if (!project) return;

  const updated: Project = {
    ...project,
    name: trimmedName,
    updatedAt: nowIso(),
  };
  updated.totalSize = calculateProjectSize(updated);
  await saveProject(updated, SAVE_META);

  if (isActive) {
    activeProject.set(updated);
  }
}

export async function deleteProjectById(projectId: string): Promise<boolean> {
  await flushPendingEditorSave();
  const allProjects = await loadProjectSummaries();
  if (allProjects.length <= 1) return false;

  await deleteProject(projectId);

  if (get(activeProject)?.id === projectId) {
    const [latest] = await loadProjectSummaries();
    if (latest) {
      await switchProject(latest.id);
    } else {
      const fallback = createEmptyProject();
      await saveProject(fallback);
      applyProjectToStores(fallback);
    }
  }
  return true;
}

/**
 * Настройки GitHub для копии проекта. Токен — секрет, поэтому без спроса
 * его не размножаем: копия без токена работает с публичными репозиториями,
 * для приватного токен можно ввести заново.
 */
async function copyGithubConfig(
  config: GithubRepoConfig | undefined,
): Promise<GithubRepoConfig | undefined> {
  if (!config) return undefined;
  const { token, ...rest } = config;
  if (!token) return { ...rest };

  const copyToken = await decide().copyGithubToken({
    repo: `${config.owner}/${config.repo}`,
  });
  return copyToken ? { ...rest, token } : { ...rest };
}

export async function duplicateProjectById(projectId: string): Promise<void> {
  await flushPendingEditorSave();
  const current = get(activeProject);
  const source =
    current?.id === projectId ? current : await loadProject(projectId);
  if (!source) return;

  const now = nowIso();
  // История версий привязана к id файлов: перекладываем на новые id.
  const fileIdMap = new Map(
    source.files.map((f) => [f.id, crypto.randomUUID()]),
  );
  const newProject: Project = {
    ...source,
    id: crypto.randomUUID(),
    name: translate("projects.copySuffix", { name: source.name }),
    files: source.files.map((f) => ({
      ...f,
      id: fileIdMap.get(f.id) ?? crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    })),
    fileVersions: source.fileVersions
      ? Object.fromEntries(
          Object.entries(source.fileVersions).flatMap(([oldId, versions]) => {
            const newId = fileIdMap.get(oldId);
            return newId ? [[newId, versions]] : [];
          }),
        )
      : undefined,
    attachments: source.attachments.map((a) => ({
      ...a,
      id: crypto.randomUUID(),
    })),
    projectTreeSource: source.projectTreeSource
      ? { ...source.projectTreeSource }
      : undefined,
    githubConfig: await copyGithubConfig(source.githubConfig),
    createdAt: now,
    updatedAt: now,
    totalSize: 0,
  };

  const sizeCheck = checkProjectSize(newProject);
  if (!sizeCheck.ok) {
    throw new Error(translate("limits.copyTooBig"));
  }

  newProject.totalSize = sizeCheck.size;
  await saveProject(newProject);
}
