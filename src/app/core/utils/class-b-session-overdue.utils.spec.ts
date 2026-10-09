import { describe, it, expect } from 'vitest';
import { isSessionOverdue, isFromPreviousDay } from './class-b-session-overdue.utils';

// scheduledAt fijo para todos los casos: la clase debía terminar a las 10:00
// (scheduledAt 09:15 + duration_min 45).
const SCHEDULED_AT = '2026-08-04T09:15:00.000Z';
const DURATION_MIN = 45;
const SCHEDULED_END = new Date('2026-08-04T10:00:00.000Z');

function minutesAfterEnd(mins: number): Date {
  return new Date(SCHEDULED_END.getTime() + mins * 60000);
}

describe('isSessionOverdue()', () => {
  it('retorna false para in_progress antes de la hora de fin agendada', () => {
    const now = minutesAfterEnd(-10); // 09:50, la clase termina a las 10:00
    expect(isSessionOverdue(SCHEDULED_AT, DURATION_MIN, 'in_progress', now)).toBe(false);
  });

  it('retorna false para in_progress justo en la hora de fin agendada (0 min de retraso)', () => {
    const now = minutesAfterEnd(0);
    expect(isSessionOverdue(SCHEDULED_AT, DURATION_MIN, 'in_progress', now)).toBe(false);
  });

  it('retorna false para in_progress con menos de 15 min de retraso', () => {
    const now = minutesAfterEnd(10);
    expect(isSessionOverdue(SCHEDULED_AT, DURATION_MIN, 'in_progress', now)).toBe(false);
  });

  it('retorna true para in_progress con exactamente 15 min de retraso (borde inclusive)', () => {
    const now = minutesAfterEnd(15);
    expect(isSessionOverdue(SCHEDULED_AT, DURATION_MIN, 'in_progress', now)).toBe(true);
  });

  it('retorna true para in_progress con más de 15 min de retraso', () => {
    const now = minutesAfterEnd(60);
    expect(isSessionOverdue(SCHEDULED_AT, DURATION_MIN, 'in_progress', now)).toBe(true);
  });

  it('retorna false para pending sin importar el tiempo transcurrido', () => {
    const now = minutesAfterEnd(120);
    expect(isSessionOverdue(SCHEDULED_AT, DURATION_MIN, 'pending', now)).toBe(false);
  });

  it('retorna false para completed sin importar el tiempo transcurrido', () => {
    const now = minutesAfterEnd(120);
    expect(isSessionOverdue(SCHEDULED_AT, DURATION_MIN, 'completed', now)).toBe(false);
  });

  it('retorna false con scheduledAt vacío (ausencia de dato, no atraso)', () => {
    const now = minutesAfterEnd(120);
    expect(isSessionOverdue('', DURATION_MIN, 'in_progress', now)).toBe(false);
  });
});

describe('isFromPreviousDay() (fix-131-m)', () => {
  // `now` es un instante; un scheduledAt sin zona se lee como hora de pared de Chile.
  const NOW = new Date('2026-08-06T16:00:00.000Z'); // 06 ago 2026, 12:00 hora Chile

  it('retorna true para un scheduledAt del día calendario anterior', () => {
    expect(isFromPreviousDay('2026-08-05T18:30:00', NOW)).toBe(true);
  });

  it('retorna true para un scheduledAt de varios días atrás', () => {
    expect(isFromPreviousDay('2026-08-01T09:00:00', NOW)).toBe(true);
  });

  it('retorna false para un scheduledAt del mismo día calendario, aunque sea temprano', () => {
    expect(isFromPreviousDay('2026-08-06T00:05:00', NOW)).toBe(false);
  });

  it('retorna false para un scheduledAt en el futuro (mismo u otro día)', () => {
    expect(isFromPreviousDay('2026-08-07T09:00:00', NOW)).toBe(false);
  });

  it('compara días de Chile, no de UTC (spec 0024-m)', () => {
    // 21:30 hora Chile del 6 de agosto: en UTC ya es día 7.
    const tonight = '2026-08-07T01:30:00.000Z';
    // 23:00 hora Chile del mismo 6 de agosto.
    expect(isFromPreviousDay(tonight, new Date('2026-08-07T03:00:00.000Z'))).toBe(false);
    // 00:10 hora Chile del 7 de agosto: la clase de anoche ya es de un día anterior.
    expect(isFromPreviousDay(tonight, new Date('2026-08-07T04:10:00.000Z'))).toBe(true);
  });

  it('retorna false con scheduledAt vacío', () => {
    expect(isFromPreviousDay('', NOW)).toBe(false);
  });

  it('retorna false con scheduledAt inválido', () => {
    expect(isFromPreviousDay('no-es-una-fecha', NOW)).toBe(false);
  });
});
