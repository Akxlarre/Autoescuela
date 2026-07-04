import { describe, it, expect } from 'vitest';
import { groupCyclesByStatus } from './ciclo-select-groups.util';
import type { CicloOption } from '@core/models/ui/ciclos-teoricos.model';

function makeCycle(overrides: Partial<CicloOption>): CicloOption {
  return {
    id: 1,
    label: 'Ciclo — Lunes 29 de junio',
    startDate: '2026-06-29',
    endDate: '2026-07-10',
    status: 'active',
    branchId: 1,
    branchName: 'Autoescuela Chillán',
    ...overrides,
  };
}

describe('groupCyclesByStatus()', () => {
  it('separa ciclos activos y finalizados en grupos distintos', () => {
    const cycles = [
      makeCycle({ id: 1, status: 'active' }),
      makeCycle({ id: 2, status: 'finished' }),
    ];

    const groups = groupCyclesByStatus(cycles);

    expect(groups).toEqual([
      { label: 'Activos', items: [{ label: cycles[0].label, value: 1 }] },
      { label: 'Finalizados', items: [{ label: cycles[1].label, value: 2 }] },
    ]);
  });

  it('omite el grupo "Finalizados" si no hay ciclos con ese estado', () => {
    const cycles = [makeCycle({ id: 1, status: 'active' })];

    const groups = groupCyclesByStatus(cycles);

    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe('Activos');
  });

  it('omite el grupo "Activos" si no hay ciclos con ese estado', () => {
    const cycles = [makeCycle({ id: 1, status: 'finished' })];

    const groups = groupCyclesByStatus(cycles);

    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe('Finalizados');
  });

  it('retorna arreglo vacío cuando no hay ciclos', () => {
    expect(groupCyclesByStatus([])).toEqual([]);
  });
});
