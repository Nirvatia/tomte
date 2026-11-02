import type { TreeNode } from "./projectTree";

export function treeToText(
  nodes: TreeNode[],
  prefix = "",
  isLast = true,
  isRoot = true,
): string {
  let result = "";
  nodes.forEach((node, index) => {
    const isLastItem = index === nodes.length - 1;
    const connector = isRoot ? "" : isLastItem ? "└── " : "├── ";
    const childPrefix = isRoot ? "" : prefix + (isLastItem ? "    " : "│   ");
    result += prefix + connector + node.name + "\n";
    if (node.type === "directory" && node.children.length > 0) {
      result += treeToText(node.children, childPrefix, isLastItem, false);
    }
  });
  return result;
}

export function buildTreeString(rootName: string, nodes: TreeNode[]): string {
  return `${rootName}/\n` + treeToText(nodes, "", true, true);
}
