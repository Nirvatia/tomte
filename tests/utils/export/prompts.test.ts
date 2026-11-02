import { describe, it, expect } from "vitest";
import { strFromU8, unzipSync } from "fflate";

import { buildPromptsZip } from "../../../src/utils/export/prompts";
import type { PromptFile } from "../../../src/types";

function prompt(id: string, name: string, content: string): PromptFile {
  return { id, name, content, createdAt: "", updatedAt: "" };
}

describe("buildPromptsZip", () => {
  it("кладёт каждый промпт отдельным Markdown-файлом", () => {
    const zip = unzipSync(
      buildPromptsZip([
        prompt(
          "1",
          "main",
          "<h1>Задача</h1><p>Сделай <strong>хорошо</strong></p>",
        ),
        prompt("2", "notes", "<ul><li><p>раз</p></li><li><p>два</p></li></ul>"),
      ]),
    );

    expect(Object.keys(zip).sort()).toEqual(["main.md", "notes.md"]);
    expect(strFromU8(zip["main.md"])).toBe("# Задача\n\nСделай **хорошо**");
    expect(strFromU8(zip["notes.md"])).toMatch(/^-\s+раз\n-\s+два$/);
  });

  it("не перезаписывает файлы с одинаковыми и недопустимыми именами", () => {
    const zip = unzipSync(
      buildPromptsZip([
        prompt("1", "task", "<p>a</p>"),
        prompt("2", "TASK.md", "<p>b</p>"),
        prompt("3", "a/b:c", "<p>c</p>"),
      ]),
    );

    expect(Object.keys(zip).sort()).toEqual([
      "TASK (2).md",
      "abc.md",
      "task.md",
    ]);
  });
});
