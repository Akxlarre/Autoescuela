import { resolveFuelExpenseBranch } from './fuel-expense-branch.utils';

describe('resolveFuelExpenseBranch (hotfix-084-b, O03)', () => {
  const deA = { branchId: 1, bothBranches: false };
  const ambasDeA = { branchId: 1, bothBranches: true };
  const sinSede = { branchId: null, bothBranches: false };

  it('vehículo "Ambas": queda en la caja de quien registra', () => {
    expect(resolveFuelExpenseBranch(ambasDeA, null, 2)).toBe(2);
    expect(resolveFuelExpenseBranch(ambasDeA, null, 1)).toBe(1);
  });

  it('vehículo "Ambas" con el admin en "Todas las sedes": su sede principal', () => {
    expect(resolveFuelExpenseBranch(ambasDeA, null, null)).toBe(1);
  });

  it('vehículo de una sede: siempre su sede', () => {
    expect(resolveFuelExpenseBranch(deA, null, 2)).toBe(1);
  });

  it('vehículo legacy sin sede: la elegida en el formulario y, si no, la activa', () => {
    expect(resolveFuelExpenseBranch(sinSede, 2, 1)).toBe(2);
    expect(resolveFuelExpenseBranch(sinSede, null, 1)).toBe(1);
    expect(resolveFuelExpenseBranch(sinSede, null, null)).toBeNull();
  });

  it('sin vehículo: formulario o activa', () => {
    expect(resolveFuelExpenseBranch(null, 2, 1)).toBe(2);
    expect(resolveFuelExpenseBranch(null, null, 1)).toBe(1);
  });
});
