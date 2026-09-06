import { describe, it, expect } from 'vitest';
import { calculateProjectSize, checkProjectSize, createEmptyProject } from '../../src/utils/projectDb';
import { PROJECT_SIZE_LIMIT } from '../../src/types';

describe('projectDb utils', () => {
  describe('createEmptyProject', () => {
    it('должен создавать проект с именем по умолчанию и одним файлом main.md', () => {
      const project = createEmptyProject();
      
      expect(project.name).toBe('Untitled Project');
      expect(project.files).toHaveLength(1);
      expect(project.files[0].name).toBe('main.md');
      expect(project.files[0].content).toBe('');
      expect(project.attachments).toHaveLength(0);
      expect(project.totalSize).toBeGreaterThan(0);
    });

    it('должен создавать проект с пользовательским именем', () => {
      const project = createEmptyProject('Мой крутой проект');
      expect(project.name).toBe('Мой крутой проект');
    });
  });

  describe('calculateProjectSize', () => {
    it('должен корректно рассчитывать размер пустого проекта', () => {
      const project = createEmptyProject();
      const size = calculateProjectSize(project);
      expect(size).toBeGreaterThan(0);
      expect(size).toBe(project.totalSize);
    });

    it('должен увеличивать размер при добавлении файлов с контентом', () => {
      const project = createEmptyProject();
      const baseSize = calculateProjectSize(project);
      
      project.files.push({
        id: '2',
        name: 'test.md',
        content: 'Hello World',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      
      const newSize = calculateProjectSize(project);
      expect(newSize).toBeGreaterThan(baseSize);
    });

    it('должен учитывать размер content и dataUrl во вложениях', () => {
      const project = createEmptyProject();
      project.attachments.push({
        id: 'att1',
        name: 'image.png',
        size: 1000,
        type: 'image',
        dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      });
      
      const size = calculateProjectSize(project);
      expect(size).toBeGreaterThan(0);
    });
  });

  describe('checkProjectSize', () => {
    it('должен возвращать ok: true для проектов в пределах лимита', () => {
      const project = createEmptyProject();
      const result = checkProjectSize(project);
      
      expect(result.ok).toBe(true);
      expect(result.size).toBe(project.totalSize);
      expect(result.limit).toBe(PROJECT_SIZE_LIMIT);
    });

    it('должен возвращать ok: false при превышении лимита', () => {
      const project = createEmptyProject();
      // Искусственно раздуваем размер для превышения лимита
      const largeContent = 'a'.repeat(PROJECT_SIZE_LIMIT + 1000);
      project.files.push({
        id: 'large',
        name: 'large.md',
        content: largeContent,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      
      const result = checkProjectSize(project);
      expect(result.ok).toBe(false);
      expect(result.size).toBeGreaterThan(PROJECT_SIZE_LIMIT);
    });
  });
});