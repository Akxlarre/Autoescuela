import { describe, expect, it } from 'vitest';
import { NO_BRANCH_SCOPE, resolveBranchScope } from './branch-scope.utils';

/**
 * Núcleo funcional del aislamiento por sede (fix-027).
 * Contrato: data-in / data-out, sin Angular.
 */
describe('resolveBranchScope', () => {
  describe('admin', () => {
    it('respeta el selector: null = todas las sedes', () => {
      expect(resolveBranchScope('admin', 7, null)).toBeNull();
    });

    it('respeta el selector: sede concreta', () => {
      expect(resolveBranchScope('admin', 7, 2)).toBe(2);
    });

    it('ignora el branchId propio del admin (manda el selector)', () => {
      expect(resolveBranchScope('admin', 1, 2)).toBe(2);
    });
  });

  describe('secretaria', () => {
    it('queda anclada a su branchId, sin importar el selector', () => {
      expect(resolveBranchScope('secretaria', 1, null)).toBe(1);
      expect(resolveBranchScope('secretaria', 1, 2)).toBe(1);
    });

    it('misconfig: branchId null → NO_BRANCH_SCOPE (jamás "todas")', () => {
      expect(resolveBranchScope('secretaria', null, null)).toBe(NO_BRANCH_SCOPE);
    });

    it('misconfig: branchId undefined → NO_BRANCH_SCOPE', () => {
      expect(resolveBranchScope('secretaria', undefined, null)).toBe(NO_BRANCH_SCOPE);
    });
  });

  describe('secretaria con grant (can_access_both_branches) — spec 0017', () => {
    it('con grant se comporta como admin: respeta el selector (null = Todas)', () => {
      expect(resolveBranchScope('secretaria', 1, null, true)).toBeNull();
    });

    it('con grant: respeta la sede elegida en el selector', () => {
      expect(resolveBranchScope('secretaria', 1, 2, true)).toBe(2);
    });

    it('sin grant (default): sigue anclada a su sede aunque el selector tenga valor', () => {
      expect(resolveBranchScope('secretaria', 1, 2, false)).toBe(1);
    });

    it('con grant pero misconfig (sin sede) usa el selector, no el sentinel', () => {
      expect(resolveBranchScope('secretaria', null, 2, true)).toBe(2);
    });
  });

  describe('otros roles no-admin', () => {
    it('se tratan como anclados (defensa): instructor con sede → su sede', () => {
      expect(resolveBranchScope('instructor', 3, null)).toBe(3);
    });

    it('rol undefined sin sede → NO_BRANCH_SCOPE', () => {
      expect(resolveBranchScope(undefined, null, 2)).toBe(NO_BRANCH_SCOPE);
    });
  });

  it('NO_BRANCH_SCOPE es un id inexistente (negativo)', () => {
    expect(NO_BRANCH_SCOPE).toBeLessThan(0);
  });
});
