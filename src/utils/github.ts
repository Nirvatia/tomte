import type { TreeNode } from './projectTree';

export interface GithubRepoConfig {
  owner: string;
  repo: string;
  branch: string;
  token?: string;
}

export function parseGithubUrl(url: string): { owner: string; repo: string } | null {
  const match = url.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (match) {
    return {
      owner: match[1],
      repo: match[2].replace(/\.git$/, ''),
    };
  }
  return null;
}

export async function fetchGithubTree(config: GithubRepoConfig): Promise<TreeNode[]> {
  const headers: HeadersInit = {
    'Accept': 'application/vnd.github.v3+json',
  };
  if (config.token) {
    headers['Authorization'] = `token ${config.token}`;
  }

  const response = await fetch(
    `https://api.github.com/repos/${config.owner}/${config.repo}/git/trees/${config.branch}?recursive=1`,
    { headers }
  );

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const flatFiles = data.tree;

  const map = new Map<string, TreeNode>();
  const root: TreeNode = {
    name: config.repo,
    path: '',
    type: 'directory',
    children: [],
    githubRef: config,
  };
  map.set('', root);

  for (const item of flatFiles) {
    if (item.type === 'blob' || item.type === 'tree') {
      const parts = item.path.split('/');
      let currentPath = '';
      
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const parentPath = currentPath;
        currentPath = currentPath ? `${currentPath}/${part}` : part;
        const isFile = i === parts.length - 1 && item.type === 'blob';

        if (!map.has(currentPath)) {
          const newNode: TreeNode = {
            name: part,
            path: currentPath,
            type: isFile ? 'file' : 'directory',
            children: [],
            githubRef: config,
          };
          map.set(currentPath, newNode);
          
          const parent = map.get(parentPath);
          if (parent) {
            parent.children.push(newNode);
          }
        }
      }
    }
  }

  function sortNodes(nodes: TreeNode[]) {
    nodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    nodes.forEach(node => {
      if (node.type === 'directory') sortNodes(node.children);
    });
  }

  sortNodes(root.children);
  return root.children;
}

export async function fetchGithubFileContent(node: TreeNode): Promise<{ content: string; size: number }> {
  if (!node.githubRef) throw new Error('Not a GitHub file');

  const url = `https://raw.githubusercontent.com/${node.githubRef.owner}/${node.githubRef.repo}/${node.githubRef.branch}/${node.path}`;
  const headers: HeadersInit = {};
  if (node.githubRef.token) {
    headers['Authorization'] = `token ${node.githubRef.token}`;
  }

  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${node.path}: ${response.status}`);
  }

  const content = await response.text();
  return { content, size: content.length };
}