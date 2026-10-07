import { describe, expect, it } from 'vitest';
import {
  computePromotionEndDate,
  holidaysOfYear,
  promotionHolidayYears,
} from './promotion-end-date.utils';

// fix-343-m — api.boostr.cl ignora el año pedido y responde con el año en curso.
describe('holidaysOfYear', () => {
  it('deja solo las fechas del año pedido', () => {
    expect(holidaysOfYear(['2026-12-25', '2027-01-01', '2027-05-01'], 2027)).toEqual([
      '2027-01-01',
      '2027-05-01',
    ]);
  });

  it('una fuente que responde con otro año queda vacía', () => {
    expect(holidaysOfYear(['2026-01-01', '2026-12-25'], 2027)).toEqual([]);
  });
});

/**
 * Núcleo funcional del cálculo de `end_date` de una promoción profesional.
 * Contrato: data-in / data-out, sin Angular, sin I/O (recibe los feriados ya resueltos).
 *
 * Regla de negocio (owner, 2026-08-07): la promoción dura 30 días hábiles (L-S, sin domingos).
 * Sin feriados en el rango, eso da `start + 33` (sábado de la 5ª semana, arrancando siempre
 * un lunes). Cada feriado dentro del rango "roba" un día hábil, así que el cálculo camina
 * día a día contando solo los que no son domingo ni feriado, hasta acumular 30.
 *
 * Como el inicio siempre es lunes, `start + 33` cae siempre sábado y `start + 34` cae siempre
 * domingo — por eso el primer día de recupero disponible tras el `+33` es el `+35` (lunes), no
 * el `+34`. Ver nota de corrección en plan.md (2026-08-07).
 */
describe('computePromotionEndDate', () => {
  const START = '2026-08-03'; // lunes

  it('sin feriados en el rango → end_date = start + 33 (sábado de la 5ª semana)', () => {
    expect(computePromotionEndDate(START, new Set())).toBe('2026-09-05');
  });

  it('1 feriado a mitad del rango → end_date = start + 35 (el +34 siempre cae domingo)', () => {
    const holidays = new Set(['2026-08-13']); // jueves, semana 2
    expect(computePromotionEndDate(START, holidays)).toBe('2026-09-07');
  });

  it('2 feriados no consecutivos → end_date = start + 36', () => {
    const holidays = new Set(['2026-08-13', '2026-08-25']); // jueves sem2, martes sem4
    expect(computePromotionEndDate(START, holidays)).toBe('2026-09-08');
  });

  it('2 feriados consecutivos (lunes y martes de la misma semana) → end_date = start + 36, sin loop infinito', () => {
    const holidays = new Set(['2026-08-17', '2026-08-18']); // lunes y martes semana 3
    expect(computePromotionEndDate(START, holidays)).toBe('2026-09-08');
  });

  it('feriado justo en lo que sería el último día (start+33) → fuerza extensión, coincide con el caso de 1 feriado', () => {
    const holidays = new Set(['2026-09-05']); // sábado, day33
    expect(computePromotionEndDate(START, holidays)).toBe('2026-09-07');
  });

  it('feriado en domingo dentro del rango → no afecta el conteo (el domingo ya estaba excluido)', () => {
    const holidays = new Set(['2026-08-09']); // domingo, semana 1
    expect(computePromotionEndDate(START, holidays)).toBe('2026-09-05');
  });
});

// fix-343-m — una promoción dura 33+ días corridos: la que parte a fines de noviembre también
// cruza a enero y necesita los feriados del año siguiente.
describe('promotionHolidayYears', () => {
  it('inicio en octubre → solo el año de inicio', () => {
    expect(promotionHolidayYears('2026-10-12')).toEqual([2026]);
  });

  it('inicio el 30 de noviembre → año de inicio y el siguiente', () => {
    expect(promotionHolidayYears('2026-11-30')).toEqual([2026, 2027]);
  });

  it('inicio en diciembre → año de inicio y el siguiente', () => {
    expect(promotionHolidayYears('2026-12-14')).toEqual([2026, 2027]);
  });

  it('inicio en enero → solo ese año', () => {
    expect(promotionHolidayYears('2027-01-11')).toEqual([2027]);
  });
});
