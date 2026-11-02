import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  fetchGithubFileContent,
  fetchGithubTree,
  parseGithubUrl,
} from '../../src/utils/github';
import { activeProject } from '../../src/stores';
import type { Project } from '../../src/types';

describe('github utils', () => {
  describe('parseGithubUrl', () => {
    it('должен парсить стандартный GitHub URL', () => {
      const result = parseGithubUrl('https://github.com/owner/repo');
      expect(result).toEqual({ owner: 'owner', repo: 'repo' });
    });

    it('должен парсить GitHub URL с суффиксом .git', () => {
      const result = parseGithubUrl('https://github.com/owner/repo.git');
      expect(result).toEqual({ owner: 'owner', repo: 'repo' });
    });

    it('должен возвращать null для невалидных URL', () => {
      expect(parseGithubUrl('https://gitlab.com/owner/repo')).toBeNull();
      expect(parseGithubUrl('not-a-url')).toBeNull();
      expect(parseGithubUrl('')).toBeNull();
    });
  });

  describe('токен GitHub', () => {
    const config = { owner: 'me', repo: 'repo', branch: 'main', token: 'ghp_secret' };

    afterEach(() => {
      vi.unstubAllGlobals();
      activeProject.set(null);
    });

    it('не кладёт токен в узлы дерева', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({
            tree: [
              { path: 'src', type: 'tree' },
              { path: 'src/a.ts', type: 'blob' },
            ],
          }),
        }),
      );

      const nodes = await fetchGithubTree(config);

      expect(JSON.stringify(nodes)).not.toContain('ghp_secret');
      expect(nodes[0].children[0].githubRef).toEqual({
        owner: 'me',
        repo: 'repo',
        branch: 'main',
      });
    });

    it('берёт токен для файла из githubConfig активного проекта', async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => 'x' });
      vi.stubGlobal('fetch', fetchMock);
      activeProject.set({ id: 'p', githubConfig: config } as unknown as Project);

      await fetchGithubFileContent({
        name: 'a.ts',
        path: 'src/a.ts',
        type: 'file',
        children: [],
        githubRef: { owner: 'me', repo: 'repo', branch: 'main' },
      });

      expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('token ghp_secret');
    });

    it('не отправляет токен в чужой репозиторий', async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => 'x' });
      vi.stubGlobal('fetch', fetchMock);
      activeProject.set({ id: 'p', githubConfig: config } as unknown as Project);

      await fetchGithubFileContent({
        name: 'a.ts',
        path: 'a.ts',
        type: 'file',
        children: [],
        githubRef: { owner: 'other', repo: 'thing', branch: 'main' },
      });

      expect(fetchMock.mock.calls[0][1].headers.Authorization).toBeUndefined();
    });
  });
});
