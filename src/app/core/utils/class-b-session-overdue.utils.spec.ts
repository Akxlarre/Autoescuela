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
  // Sin sufijo 'Z': se interpretan como hora local, igual que `now` (construido con
  // el constructor local de Date) — evita falsos negativos/positivos por huso horario
  // en las fronteras de día calendario.
  const NOW = new Date(2026, 7, 6, 12, 0, 0); // 06 ago 2026, 12:00 local

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

  it('retorna false con scheduledAt vacío', () => {
    expect(isFromPreviousDay('', NOW)).toBe(false);
  });

  it('retorna false con scheduledAt inválido', () => {
    expect(isFromPreviousDay('no-es-una-fecha', NOW)).toBe(false);
  });
});
