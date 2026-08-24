// @ts-ignore
import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";

import type { AttachedFile } from "../../types";

import { sanitizeFileName } from "../index";

const turndownService = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  bulletListMarker: "-",
  emDelimiter: "*",
  strongDelimiter: "**",
});

turndownService.use(gfm);

turndownService.addRule("strikethrough", {
  filter: ["del", "s", "strike"],
  replacement: (content) => `~~${content}~~`,
});

turndownService.addRule("mark", {
  filter: "mark",
  replacement: (content) => `==${content}==`,
});

turndownService.addRule("lineBreak", {
  filter: "br",
  replacement: () => "  \n",
});

export async function exportToMD(
  editorHtml: string,
  files: AttachedFile[],
  fileName: string,
): Promise<void> {
  let markdown = turndownService.turndown(editorHtml);

  const filesToExport = files.filter((f) => f.content);
  if (filesToExport.length > 0) {
    markdown += "\n\n---\n\n## 📎 Прикреплённые файлы\n\n";
    for (const file of filesToExport) {
      const ext = file.name.split(".").pop()?.toLowerCase() || "";
      const supportedLangs = [
        "js",
        "ts",
        "python",
        "html",
        "css",
        "json",
        "md",
        "svelte",
        "yaml",
        "yml",
        "rust",
        "go",
        "java",
        "cpp",
        "c",
        "h",
        "php",
        "rb",
        "sh",
        "xml",
        "sql",
        "bash",
        "zsh",
      ];
      const lang = supportedLangs.includes(ext) ? ext : "";
      markdown += `### 📄 \`${file.name}\`\n\n`;
      markdown += `\`\`\`${lang}\n${file.content}\n\`\`\`\n\n`;
    }
  }

  const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${sanitizeFileName(fileName)}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
