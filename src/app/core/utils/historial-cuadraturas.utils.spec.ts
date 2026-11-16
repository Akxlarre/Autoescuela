import { describe, expect, it } from 'vitest';
import type { HistorialCierre } from '@core/models/ui/historial-cuadraturas.model';
import { groupCierresByFecha } from './historial-cuadraturas.utils';

function cierre(id: number, fecha: string, branchId: number): HistorialCierre {
  return { id, fecha, branchId, sedeNombre: `Sede ${branchId}` } as HistorialCierre;
}

describe('groupCierresByFecha (fix-078-i)', () => {
  it('dos sedes que cierran el mismo día quedan las dos en la fecha', () => {
    const map = groupCierresByFecha([
      cierre(1, '2026-11-10', 1),
      cierre(2, '2026-11-10', 2),
      cierre(3, '2026-11-12', 1),
    ]);
    expect(map.get('2026-11-10')?.map((c) => c.id)).toEqual([1, 2]);
    expect(map.get('2026-11-12')?.map((c) => c.id)).toEqual([3]);
  });

  it('ordena por sede dentro del día, sin importar el orden de llegada', () => {
    const map = groupCierresByFecha([cierre(2, '2026-11-10', 2), cierre(1, '2026-11-10', 1)]);
    expect(map.get('2026-11-10')?.map((c) => c.branchId)).toEqual([1, 2]);
  });

  it('un día sin cierres no aparece', () => {
    expect(groupCierresByFecha([]).size).toBe(0);
  });
});
