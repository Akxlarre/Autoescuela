import {
  isSedeDisabled,
  isBothBranchesVisible,
  isBothBranchesDisabled,
} from './branch-scope-ui.utils';

describe('branch-scope-ui.utils (spec 0004-m)', () => {
  describe('isSedeDisabled', () => {
    it('admin: false (puede elegir/cambiar sede)', () => {
      expect(isSedeDisabled('admin')).toBe(false);
    });
    it('secretary: true (nunca elige su propia sede)', () => {
      expect(isSedeDisabled('secretary')).toBe(true);
    });
  });

  describe('isBothBranchesVisible', () => {
    it('admin + crear: true', () => {
      expect(isBothBranchesVisible('admin', 'crear')).toBe(true);
    });
    it('admin + editar: true', () => {
      expect(isBothBranchesVisible('admin', 'editar')).toBe(true);
    });
    it('secretary + crear: false (AC2 — nunca crea "Ambas")', () => {
      expect(isBothBranchesVisible('secretary', 'crear')).toBe(false);
    });
    it('secretary + editar: true (AC3 — puede VER el scope, no editarlo)', () => {
      expect(isBothBranchesVisible('secretary', 'editar')).toBe(true);
    });
  });

  describe('isBothBranchesDisabled', () => {
    it('admin: false', () => {
      expect(isBothBranchesDisabled('admin')).toBe(false);
    });
    it('secretary: true (nunca puede setear both_branches)', () => {
      expect(isBothBranchesDisabled('secretary')).toBe(true);
    });
  });
});
