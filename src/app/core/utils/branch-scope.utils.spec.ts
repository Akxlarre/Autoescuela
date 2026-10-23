import { describe, expect, it } from 'vitest';
import {
  NO_BRANCH_SCOPE,
  canChooseBranch,
  resolveBranchScope,
  scopeStudentsToBranch,
} from './branch-scope.utils';

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

// Extraído en fix-168-b: hay queries donde el branch_id resuelto no sirve como filtro
// (en `announcements`, NULL significa "a todas las sedes") y lo único que importa es
// quién puede elegir sede. La regla de rol vive en un solo lugar a propósito: la causa
// de ese fix fue reimplementarla a mano en un facade.
describe('canChooseBranch', () => {
  it('el admin elige', () => {
    expect(canChooseBranch('admin')).toBe(true);
  });

  it('la secretaria sin grant queda anclada', () => {
    expect(canChooseBranch('secretaria')).toBe(false);
  });

  it('la secretaria CON grant multi-sede elige (spec 0017)', () => {
    expect(canChooseBranch('secretaria', true)).toBe(true);
  });

  it('un rol desconocido queda anclado, no elige', () => {
    expect(canChooseBranch(undefined)).toBe(false);
  });

  it('coincide con la rama que toma resolveBranchScope', () => {
    // Si divergieran, el helper y sus consumidores dirían cosas distintas sobre el
    // mismo usuario, que es exactamente el bug que este predicado viene a evitar.
    for (const [role, grant] of [
      ['admin', false],
      ['secretaria', false],
      ['secretaria', true],
      ['instructor', false],
    ] as const) {
      const eligeSegunScope = resolveBranchScope(role, 9, 4, grant) === 4;
      expect(canChooseBranch(role, grant)).toBe(eligeSegunScope);
    }
  });
});

// fix-458-m (DG-115): un alumno es de cada sede donde tiene matrícula, no solo de la de su usuario.
describe('scopeStudentsToBranch', () => {
  const alumno = (id: number, userBranch: number | null, enrollmentBranches: number[]) => ({
    id,
    users: { branch_id: userBranch },
    enrollments: enrollmentBranches.map((b, i) => ({ id: id * 10 + i, branch_id: b })),
  });

  it('sin sede (null = todas) devuelve todo tal cual', () => {
    const rows = [alumno(1, 1, [1]), alumno(2, 2, [2])];
    expect(scopeStudentsToBranch(rows, null)).toBe(rows);
  });

  it('incluye al alumno de otra sede que tiene una matrícula en la sede elegida, solo con esa matrícula', () => {
    const out = scopeStudentsToBranch([alumno(84, 2, [2, 1])], 1);
    expect(out).toHaveLength(1);
    expect(out[0].enrollments.map((e) => e.branch_id)).toEqual([1]);
  });

  it('excluye al alumno de la sede elegida cuyas matrículas son todas de la otra sede', () => {
    expect(scopeStudentsToBranch([alumno(5, 1, [2])], 1)).toEqual([]);
  });

  it('un alumno sin matrículas aparece solo en la sede de su usuario', () => {
    const sinMatricula = alumno(7, 1, []);
    expect(scopeStudentsToBranch([sinMatricula], 1)).toEqual([sinMatricula]);
    expect(scopeStudentsToBranch([sinMatricula], 2)).toEqual([]);
  });

  it('NO_BRANCH_SCOPE (secretaria sin sede) → ninguna fila', () => {
    expect(
      scopeStudentsToBranch([alumno(1, 1, [1]), alumno(9, null, [])], NO_BRANCH_SCOPE),
    ).toEqual([]);
  });
});
