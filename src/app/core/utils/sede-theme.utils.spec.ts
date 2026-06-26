import { describe, it, expect } from 'vitest';
import { branchIdToTheme, DEFAULT_SEDE_THEME, type SedeTheme } from './sede-theme.utils';

describe('sede-theme.utils', () => {
  describe('branchIdToTheme', () => {
    it('maps sede 1 to the "roja" theme', () => {
      const theme: SedeTheme = branchIdToTheme(1);
      expect(theme).toBe('roja');
    });

    it('maps sede 2 to the "azul" theme', () => {
      const theme: SedeTheme = branchIdToTheme(2);
      expect(theme).toBe('azul');
    });

    it('falls back to the default theme when branchId is null (sin sede en la URL)', () => {
      expect(branchIdToTheme(null)).toBe(DEFAULT_SEDE_THEME);
    });

    it('falls back to the default theme for unknown or invalid branchIds', () => {
      expect(branchIdToTheme(999)).toBe(DEFAULT_SEDE_THEME);
      expect(branchIdToTheme(0)).toBe(DEFAULT_SEDE_THEME);
      expect(branchIdToTheme(-1)).toBe(DEFAULT_SEDE_THEME);
    });

    it('uses "roja" as the documented default theme', () => {
      expect(DEFAULT_SEDE_THEME).toBe('roja');
    });
  });
});
