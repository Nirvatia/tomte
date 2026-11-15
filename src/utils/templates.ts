/**
 * Этап 10.2. Шаблоны с переменными: {{task}}, {{lang}} прямо в тексте промпта.
 *
 * Перед экспортом переменные находятся по тексту и предлагается форма
 * заполнения; значения подставляются в HTML с экранированием, чтобы
 * введённый текст не ломал разметку. Переменные без значения остаются
 * как есть — пользователь увидит {{name}} в выгрузке и поймёт, что забыл.
 */

const VARIABLE_RE = /\{\{\s*([\p{L}\p{N}_-]+)\s*\}\}/gu;

/** Уникальные имена переменных в порядке появления. */
export function findVariables(html: string): string[] {
  const found: string[] = [];
  const seen = new Set<string>();
  for (const match of html.matchAll(VARIABLE_RE)) {
    const name = match[1];
    if (!seen.has(name)) {
      seen.add(name);
      found.push(name);
    }
  }
  return found;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Подставляет значения; незаполненные переменные оставляет как {{name}}. */
export function substituteVariables(
  html: string,
  values: Record<string, string>,
): string {
  return html.replace(VARIABLE_RE, (raw, name: string) => {
    const value = values[name];
    return value !== undefined ? escapeHtml(value) : raw;
  });
}

/** Память значений на сессию: повторный экспорт не заставляет вводить заново. */
const remembered = new Map<string, string>();

export function rememberValues(values: Record<string, string>): void {
  for (const [name, value] of Object.entries(values))
    remembered.set(name, value);
}

/** Ранее введённые значения для предзаполнения формы. */
export function rememberedValues(names: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const name of names) {
    const value = remembered.get(name);
    if (value !== undefined) result[name] = value;
  }
  return result;
}
