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

function prepareHtmlForMarkdown(html: string): string {
  if (!html || !html.trim()) return html;
  const doc = new DOMParser().parseFromString(html, "text/html");

  const BLOCK_TAGS = [
    "P",
    "DIV",
    "BLOCKQUOTE",
    "PRE",
    "UL",
    "OL",
    "TABLE",
    "H1",
    "H2",
    "H3",
    "H4",
    "H5",
    "H6",
    "HR",
  ];

  doc.querySelectorAll("li > p").forEach((p) => {
    const parent = p.parentElement;
    if (!parent) return;

    const hasOtherBlocks = Array.from(parent.children).some(
      (child) => child !== p && BLOCK_TAGS.includes(child.tagName),
    );

    if (!hasOtherBlocks) {
      while (p.firstChild) {
        parent.insertBefore(p.firstChild, p);
      }
      parent.removeChild(p);
    }
  });

  return doc.body.innerHTML;
}

function tightenLists(markdown: string): string {
  const lines = markdown.split("\n");
  const result: string[] = [];
  const listItemRe = /^[ \t]*(?:[-*+]|\d+[.)])[ \t]+/;
  let inFence = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (/^ {0,3}(?:```|~~~)/.test(line)) {
      inFence = !inFence;
      result.push(line);
      continue;
    }
    if (inFence || line.trim() !== "") {
      result.push(line);
      continue;
    }

    let prev: string | null = null;
    for (let j = result.length - 1; j >= 0; j--) {
      if (result[j].trim() !== "") {
        prev = result[j];
        break;
      }
    }

    let next: string | null = null;
    for (let j = i + 1; j < lines.length; j++) {
      if (lines[j].trim() !== "") {
        next = lines[j];
        break;
      }
    }

    if (
      prev !== null &&
      next !== null &&
      listItemRe.test(prev) &&
      listItemRe.test(next)
    ) {
      continue;
    }

    result.push(line);
  }

  return result.join("\n");
}

export async function exportToMD(
  editorHtml: string,
  files: AttachedFile[],
  fileName: string,
): Promise<void> {
  const preparedHtml = prepareHtmlForMarkdown(editorHtml);
  let markdown = turndownService.turndown(preparedHtml);
  markdown = tightenLists(markdown);

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