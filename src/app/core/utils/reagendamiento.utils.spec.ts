import { describe, expect, it } from 'vitest';
import { isRazonReagendamientoCompleta } from './reagendamiento.utils';

describe('isRazonReagendamientoCompleta() — fix-279-m', () => {
  it('si no se requiere razón (clase sin sesión previa), siempre está completa', () => {
    expect(isRazonReagendamientoCompleta(false, null, '')).toBe(true);
  });

  it('requerida y sin elegir: incompleta', () => {
    expect(isRazonReagendamientoCompleta(true, null, '')).toBe(false);
    expect(isRazonReagendamientoCompleta(true, '', '')).toBe(false);
  });

  it('requerida y elegida de la lista: completa', () => {
    expect(isRazonReagendamientoCompleta(true, 'medica', '')).toBe(true);
  });

  it('"otro" exige el detalle escrito, sin contar espacios', () => {
    expect(isRazonReagendamientoCompleta(true, 'otro', '')).toBe(false);
    expect(isRazonReagendamientoCompleta(true, 'otro', '   ')).toBe(false);
    expect(isRazonReagendamientoCompleta(true, 'otro', 'Mudanza')).toBe(true);
  });
});
