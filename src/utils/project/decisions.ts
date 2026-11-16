/**
 * Решения пользователя посреди действия над проектом (этап 15.1).
 *
 * Иногда действию нужен ответ пользователя: файлы не влезли в лимит —
 * добавить их без содержимого? Модули данных не рисуют окна сами:
 * они спрашивают через этот интерфейс, а реализацию с окнами
 * подтверждения регистрирует интерфейс приложения
 * (src/lib/projectDecisions.ts, подключается в +layout.svelte).
 *
 * Пока реализация не зарегистрирована (юнит-тесты, код без интерфейса),
 * ответ на всё — безопасное «нет».
 */
export interface ProjectDecisions {
  /** Вложения не влезли в лимит: добавить новые без содержимого? */
  addAttachmentsAsMetadata(info: {
    size: string;
    limit: string;
  }): Promise<boolean>;
  /** Дерево с содержимым не влезло: сохранить только структуру? */
  saveTreeStructureOnly(info: { limit: string }): Promise<boolean>;
  /** Копия проекта: переносить ли GitHub-токен (секрет) в копию? */
  copyGithubToken(info: { repo: string }): Promise<boolean>;
}

const declineAll: ProjectDecisions = {
  addAttachmentsAsMetadata: async () => false,
  saveTreeStructureOnly: async () => false,
  copyGithubToken: async () => false,
};

let current: ProjectDecisions = declineAll;

export function setProjectDecisions(decisions: ProjectDecisions | null): void {
  current = decisions ?? declineAll;
}

export function decide(): ProjectDecisions {
  return current;
}
