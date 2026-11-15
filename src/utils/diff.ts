/**
 * Этап 10.3. Построчный diff для истории версий.
 * Простой LCS по строкам: для промптов (сотни строк) его хватает с запасом.
 */

export interface DiffLine {
  type: "same" | "add" | "remove";
  text: string;
}

/** Предел поля DP: сверх него честный diff не считаем, рискуем только тормозами. */
const MAX_CELLS = 4_000_000;

export function diffLines(oldText: string, newText: string): DiffLine[] {
  // Пустой текст — ноль строк, а не одна пустая: иначе в diff лезут
  // фантомные удаления пустых строк.
  const a = oldText === "" ? [] : oldText.split("\n");
  const b = newText === "" ? [] : newText.split("\n");
  const m = a.length;
  const n = b.length;

  if (m * n > MAX_CELLS) {
    return [
      ...a.map((text) => ({ type: "remove" as const, text })),
      ...b.map((text) => ({ type: "add" as const, text })),
    ];
  }

  // dp[i][j] — длина LCS для a[i:] и b[j:].
  const dp: Uint32Array[] = Array.from(
    { length: m + 1 },
    () => new Uint32Array(n + 1),
  );
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i][j] =
        a[i] === b[j]
          ? dp[i + 1][j + 1] + 1
          : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const result: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (a[i] === b[j]) {
      result.push({ type: "same", text: a[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      result.push({ type: "remove", text: a[i] });
      i++;
    } else {
      result.push({ type: "add", text: b[j] });
      j++;
    }
  }
  while (i < m) result.push({ type: "remove", text: a[i++] });
  while (j < n) result.push({ type: "add", text: b[j++] });
  return result;
}

/** Сводка для заголовка diff-окна: сколько добавлено и удалено. */
export function countChanges(lines: DiffLine[]): {
  added: number;
  removed: number;
} {
  let added = 0;
  let removed = 0;
  for (const line of lines) {
    if (line.type === "add") added++;
    if (line.type === "remove") removed++;
  }
  return { added, removed };
}
