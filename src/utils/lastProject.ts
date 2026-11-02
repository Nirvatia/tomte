/**
 * Какой проект был открыт последним. Хранится в localStorage этого браузера:
 * это удобство, а не данные. Если хранилище недоступно, просто откроется
 * самый свежий проект.
 */
const KEY = "tomte:lastProjectId";

export function rememberLastProject(projectId: string): void {
  try {
    localStorage.setItem(KEY, projectId);
  } catch {
    // Приватный режим, запрет хранилища и т.п.
  }
}

export function getLastProjectId(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}
