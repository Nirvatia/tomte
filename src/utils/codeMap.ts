import type { TreeNode } from "./projectTree";
import { fetchGithubFileContent } from "./github";
import { isOutlineSupported, parseFileOutline } from "./treeSitter";

async function readFileContent(node: TreeNode): Promise<string | null> {
  if (node.fileRef) {
    if (node.fileRef instanceof File) {
      return await node.fileRef.text();
    } else {
      const file = await (node.fileRef as FileSystemFileHandle).getFile();
      return await file.text();
    }
  } else if (node.githubRef) {
    const githubFile = await fetchGithubFileContent(node);
    return githubFile.content;
  }
  return null;
}

export async function generateCodeMap(rootNode: TreeNode): Promise<string> {
  const lines: string[] = [];

  async function processNode(node: TreeNode) {
    if (node.type === "directory") {
      lines.push(`${node.name}/`);
      for (const child of node.children) {
        await processNode(child);
      }
    } else {
      if (node.name.endsWith(".svelte")) return;

      const ext = node.name.split(".").pop()?.toLowerCase() || "";
      if (!isOutlineSupported(ext)) return;

      try {
        const content = await readFileContent(node);
        if (!content) return;

        const outline = await parseFileOutline(content, ext);
        if (outline.length > 0) {
          lines.push(`${node.name}:`);
          for (const line of outline) {
            lines.push(`  ${line}`);
          }
        }
      } catch (err) {
        console.warn(`Error parsing ${node.path}:`, err);
      }
    }
  }

  await processNode(rootNode);
  return lines.join("\n");
}
