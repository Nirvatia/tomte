import { describe, it, expect } from 'vitest';
import { parseGithubUrl } from '../../src/utils/github';

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
});