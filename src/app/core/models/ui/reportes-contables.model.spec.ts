import { describe, expect, it } from 'vitest';
import { computeDateRange } from './reportes-contables.model';

describe('computeDateRange — rangos según el día de Chile (spec 0024-m)', () => {
  // 23:30 hora Chile del 30 de junio de 2026 = 03:30 UTC del 1 de julio.
  const lastNightOfJune = new Date('2026-07-01T03:30:00.000Z');

  it('mes actual: a las 23:30 del último día sigue siendo junio', () => {
    expect(computeDateRange('mes_actual', undefined, undefined, lastNightOfJune)).toEqual([
      '2026-06-01',
      '2026-06-30',
    ]);
  });

  it('mes anterior: mayo completo', () => {
    expect(computeDateRange('mes_anterior', undefined, undefined, lastNightOfJune)).toEqual([
      '2026-05-01',
      '2026-05-31',
    ]);
  });

  it('trimestre: desde el primer día de hace dos meses hasta hoy', () => {
    expect(computeDateRange('trimestre', undefined, undefined, lastNightOfJune)).toEqual([
      '2026-04-01',
      '2026-06-30',
    ]);
  });

  it('año actual: a las 23:30 del 31 de diciembre el año no avanza', () => {
    const newYearsEve = new Date('2027-01-01T02:30:00.000Z');
    expect(computeDateRange('anio_actual', undefined, undefined, newYearsEve)).toEqual([
      '2026-01-01',
      '2026-12-31',
    ]);
  });

  it('personalizado: respeta las fechas dadas y completa con hoy la que falte', () => {
    expect(computeDateRange('personalizado', '2026-03-10', '2026-03-20', lastNightOfJune)).toEqual([
      '2026-03-10',
      '2026-03-20',
    ]);
    expect(computeDateRange('personalizado', undefined, undefined, lastNightOfJune)).toEqual([
      '2026-06-30',
      '2026-06-30',
    ]);
  });
});
