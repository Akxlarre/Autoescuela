import { describe, expect, it } from 'vitest';
import { puedeAvanzarMes } from './month-nav.utils';

// 2026-11-17T02:30Z = 16-11-2026 23:30 hora Chile (UTC-3): todavía noviembre en Chile.
const NOV_CHILE = new Date('2026-11-17T02:30:00.000Z');
// 2026-12-01T02:30Z = 30-11-2026 23:30 hora Chile: en UTC ya es diciembre, en Chile no.
const FIN_NOV_CHILE = new Date('2026-12-01T02:30:00.000Z');

describe('puedeAvanzarMes', () => {
  it('false en el mes actual', () => {
    expect(puedeAvanzarMes(2026, 11, NOV_CHILE)).toBe(false);
  });

  it('true en un mes pasado del mismo año', () => {
    expect(puedeAvanzarMes(2026, 10, NOV_CHILE)).toBe(true);
  });

  it('true en diciembre del año anterior (cambio de año)', () => {
    expect(puedeAvanzarMes(2025, 12, NOV_CHILE)).toBe(true);
  });

  it('false en un mes futuro', () => {
    expect(puedeAvanzarMes(2026, 12, NOV_CHILE)).toBe(false);
    expect(puedeAvanzarMes(2027, 1, NOV_CHILE)).toBe(false);
  });

  it('usa el mes de Chile, no el de UTC', () => {
    expect(puedeAvanzarMes(2026, 11, FIN_NOV_CHILE)).toBe(false);
    expect(puedeAvanzarMes(2026, 10, FIN_NOV_CHILE)).toBe(true);
  });
});
