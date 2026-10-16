import { describe, it, expect } from 'vitest';
import { cycleMoveTargets, groupCyclesByStatus } from './ciclo-select-groups.util';
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

describe('cycleMoveTargets() — fix-387-m', () => {
  const cycles = [
    makeCycle({ id: 1, branchId: 1, label: 'A1' }),
    makeCycle({ id: 2, branchId: 2, label: 'B1' }),
    makeCycle({ id: 3, branchId: 1, label: 'A2', status: 'finished' }),
    makeCycle({ id: 4, branchId: 2, label: 'B2' }),
  ];

  it('ofrece solo los otros ciclos de la sede del ciclo elegido', () => {
    expect(cycleMoveTargets(cycles, 1)).toEqual([{ label: 'A2', value: 3 }]);
    expect(cycleMoveTargets(cycles, 2)).toEqual([{ label: 'B2', value: 4 }]);
  });

  it('sin ciclo elegido, o con uno que no está en la lista, no ofrece destinos', () => {
    expect(cycleMoveTargets(cycles, null)).toEqual([]);
    expect(cycleMoveTargets(cycles, 99)).toEqual([]);
  });
});

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
