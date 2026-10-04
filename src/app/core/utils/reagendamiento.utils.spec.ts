import { describe, expect, it } from 'vitest';
import { isRazonReagendamientoCompleta, slotChocaConClases } from './reagendamiento.utils';

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

describe('slotChocaConClases() — fix-299-m', () => {
  const slot = ['2026-10-12T11:30:00+00:00', '2026-10-12T12:15:00+00:00'] as const;

  it('sin otras clases no choca', () => {
    expect(slotChocaConClases(...slot, [])).toBe(false);
  });

  it('choca con una clase a la misma hora, aunque venga escrita en otro formato', () => {
    expect(slotChocaConClases(...slot, ['2026-10-12T11:30:00+00:00'])).toBe(true);
    expect(slotChocaConClases(...slot, ['2026-10-12T08:30:00-03:00'])).toBe(true);
    expect(slotChocaConClases(...slot, ['2026-10-12T11:30:00.000Z'])).toBe(true);
  });

  it('choca si se cruzan en parte', () => {
    expect(slotChocaConClases(...slot, ['2026-10-12T11:00:00+00:00'])).toBe(true);
    expect(slotChocaConClases(...slot, ['2026-10-12T12:00:00+00:00'])).toBe(true);
  });

  it('una clase que termina justo cuando empieza el horario (o empieza cuando termina) no choca', () => {
    expect(slotChocaConClases(...slot, ['2026-10-12T10:45:00+00:00'])).toBe(false);
    expect(slotChocaConClases(...slot, ['2026-10-12T12:15:00+00:00'])).toBe(false);
  });

  it('otra clase el mismo día a otra hora, u otro día a la misma hora, no choca', () => {
    expect(slotChocaConClases(...slot, ['2026-10-12T15:00:00+00:00'])).toBe(false);
    expect(slotChocaConClases(...slot, ['2026-10-13T11:30:00+00:00'])).toBe(false);
  });

  it('ignora fechas vacías o ilegibles', () => {
    expect(slotChocaConClases(...slot, ['', 'no-es-fecha'])).toBe(false);
  });
});
