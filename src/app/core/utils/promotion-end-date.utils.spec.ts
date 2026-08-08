import { describe, expect, it } from 'vitest';
import { computePromotionEndDate } from './promotion-end-date.utils';

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
