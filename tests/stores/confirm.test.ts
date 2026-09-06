import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { confirmState, requestConfirm, requestAlert, closeConfirm } from '../../src/stores/confirm';

describe('confirm store', () => {
  beforeEach(() => {
    // Сброс состояния перед каждым тестом
    closeConfirm(false);
  });

  describe('requestConfirm', () => {
    it('должен открывать модалку и возвращать true при подтверждении', async () => {
      const promise = requestConfirm({ message: 'Вы уверены?' });
      
      expect(get(confirmState).open).toBe(true);
      expect(get(confirmState).message).toBe('Вы уверены?');
      
      closeConfirm(true);
      
      const result = await promise;
      expect(result).toBe(true);
      expect(get(confirmState).open).toBe(false);
    });

    it('должен возвращать false при отмене', async () => {
      const promise = requestConfirm({ message: 'Вы уверены?' });
      closeConfirm(false);
      
      const result = await promise;
      expect(result).toBe(false);
    });

    it('должен использовать значения по умолчанию для отсутствующих опций', async () => {
      const promise = requestConfirm({ message: 'Тест' });
      const state = get(confirmState);
      
      expect(state.title).toBe('Подтверждение');
      expect(state.confirmText).toBe('Подтвердить');
      expect(state.cancelText).toBe('Отмена');
      expect(state.danger).toBe(false);
      expect(state.hideCancel).toBe(false);
      
      closeConfirm(false);
      await promise;
    });

    it('должен автоматически отменять предыдущий промис при новом вызове', async () => {
      const promise1 = requestConfirm({ message: 'Первый' });
      const promise2 = requestConfirm({ message: 'Второй' });
      
      closeConfirm(true);
      
      const result1 = await promise1;
      const result2 = await promise2;
      
      expect(result1).toBe(false); // Предыдущий должен быть разрешен как false (отменен)
      expect(result2).toBe(true);
    });
  });

  describe('requestAlert', () => {
    it('должен открывать модалку с hideCancel=true', async () => {
      const promise = requestAlert({ message: 'Информация' });
      const state = get(confirmState);
      
      expect(state.hideCancel).toBe(true);
      expect(state.cancelText).toBe('');
      
      closeConfirm(true);
      expect(await promise).toBe(true);
    });
  });
});