import { describe, expect, it } from 'vitest';
import vectors from './chile-time.vectors.json';
import {
  addDaysIso,
  addMonthsIso,
  calendarDateToIso,
  chileDayRange,
  chileMonth,
  chileMonthRange,
  chileParts,
  chileRange,
  chileToday,
  chileWallTimeToInstant,
  chileYear,
  diffDaysIso,
  formatChileDate,
  formatChileTime,
  isoToCalendarDate,
  mondayOfIso,
  toChileDate,
  weekdayOfIso,
} from './chile-time.utils';

const HOUR_MS = 3_600_000;

describe('toChileDate — día de Chile de un instante', () => {
  it.each(vectors.instantToDate)('$instant → $date ($note)', ({ instant, date }) => {
    expect(toChileDate(instant)).toBe(date);
    expect(toChileDate(new Date(instant))).toBe(date);
  });

  it('una fecha pura se devuelve tal cual, sin desplazarse', () => {
    expect(toChileDate('2026-10-06')).toBe('2026-10-06');
    expect(toChileDate('1990-01-01')).toBe('1990-01-01');
  });

  it('un instante sin zona se toma como hora de pared de Chile', () => {
    expect(toChileDate('2026-10-06T23:30:00')).toBe('2026-10-06');
    expect(toChileDate('2026-10-06 00:10:00')).toBe('2026-10-06');
  });

  it.each([null, undefined, '', 'no-es-fecha'])('%s → cadena vacía', (value) => {
    expect(toChileDate(value)).toBe('');
  });
});

describe('chileToday / chileMonth / chileYear', () => {
  it('a las 23:30 hora Chile sigue siendo hoy', () => {
    const now = new Date('2026-10-07T02:30:00.000Z');
    expect(chileToday(now)).toBe('2026-10-06');
    expect(chileMonth(now)).toBe('2026-10');
    expect(chileYear(now)).toBe(2026);
  });

  it('a las 23:30 del último día del mes el mes actual no avanza', () => {
    const now = new Date('2026-07-01T03:30:00.000Z');
    expect(chileToday(now)).toBe('2026-06-30');
    expect(chileMonth(now)).toBe('2026-06');
  });

  it('a las 23:30 del 31 de diciembre el año no avanza', () => {
    const now = new Date('2027-01-01T02:30:00.000Z');
    expect(chileToday(now)).toBe('2026-12-31');
    expect(chileMonth(now)).toBe('2026-12');
    expect(chileYear(now)).toBe(2026);
  });

  it('sin argumento usa el reloj actual', () => {
    expect(chileToday()).toBe(toChileDate(new Date()));
  });
});

describe('chileParts', () => {
  it('descompone un instante en hora de pared de Chile', () => {
    expect(chileParts('2026-10-07T02:30:15.000Z')).toEqual({
      year: 2026,
      month: 10,
      day: 6,
      hour: 23,
      minute: 30,
      second: 15,
      weekday: 2,
    });
  });

  it('la medianoche es la hora 0, no la 24', () => {
    expect(chileParts('2026-10-07T03:00:00.000Z').hour).toBe(0);
  });
});

describe('chileDayRange — rango semiabierto de instantes de un día', () => {
  it.each(vectors.dayRange)('$date dura $hours horas', ({ date, start, endExclusive, hours }) => {
    const range = chileDayRange(date);
    expect(range.start).toBe(start);
    expect(range.endExclusive).toBe(endExclusive);
    expect((Date.parse(range.endExclusive) - Date.parse(range.start)) / HOUR_MS).toBe(hours);
  });

  it('los días consecutivos son contiguos: sin huecos ni solapes', () => {
    let cursor = '2026-03-30';
    for (let i = 0; i < 200; i++) {
      const next = addDaysIso(cursor, 1);
      expect(chileDayRange(cursor).endExclusive).toBe(chileDayRange(next).start);
      cursor = next;
    }
  });

  it('el primer y el último milisegundo del día caen en ese día y en ningún otro', () => {
    for (const { date } of vectors.dayRange) {
      const { start, endExclusive } = chileDayRange(date);
      expect(toChileDate(start)).toBe(date);
      expect(toChileDate(new Date(Date.parse(endExclusive) - 1))).toBe(date);
      expect(toChileDate(new Date(Date.parse(start) - 1))).toBe(addDaysIso(date, -1));
      expect(toChileDate(endExclusive)).toBe(addDaysIso(date, 1));
    }
  });
});

describe('chileRange / chileMonthRange', () => {
  it('chileRange cubre desde el inicio del primer día hasta el fin del último', () => {
    expect(chileRange('2026-10-01', '2026-10-06')).toEqual({
      start: '2026-10-01T03:00:00.000Z',
      endExclusive: '2026-10-07T03:00:00.000Z',
    });
  });

  it('chileMonthRange cubre el mes completo aunque cambie el horario dentro', () => {
    expect(chileMonthRange('2026-04')).toEqual({
      start: '2026-04-01T03:00:00.000Z',
      endExclusive: '2026-05-01T04:00:00.000Z',
    });
    expect(chileMonthRange('2026-12')).toEqual({
      start: '2026-12-01T03:00:00.000Z',
      endExclusive: '2027-01-01T03:00:00.000Z',
    });
  });
});

describe('chileWallTimeToInstant', () => {
  it.each(vectors.wallTimeToInstant)('$date $time → $instant', ({ date, time, instant }) => {
    expect(chileWallTimeToInstant(date, time)).toBe(instant);
  });
});

describe('aritmética de fechas puras (sin zona)', () => {
  it.each(vectors.addDays)('$date + $days = $result', ({ date, days, result }) => {
    expect(addDaysIso(date, days)).toBe(result);
  });

  it.each(vectors.weekday)('$date es día $weekday; su lunes es $monday', (v) => {
    expect(weekdayOfIso(v.date)).toBe(v.weekday);
    expect(mondayOfIso(v.date)).toBe(v.monday);
  });

  it('diffDaysIso cuenta días de calendario, también a través del cambio de horario', () => {
    expect(diffDaysIso('2026-10-06', '2026-10-06')).toBe(0);
    expect(diffDaysIso('2026-10-06', '2026-10-09')).toBe(3);
    expect(diffDaysIso('2026-10-09', '2026-10-06')).toBe(-3);
    expect(diffDaysIso('2026-04-01', '2026-04-10')).toBe(9);
    expect(diffDaysIso('2026-09-01', '2026-09-10')).toBe(9);
  });

  it('addMonthsIso recorta al último día cuando el mes destino es más corto', () => {
    expect(addMonthsIso('2026-10-06', -3)).toBe('2026-07-06');
    expect(addMonthsIso('2026-03-31', -1)).toBe('2026-02-28');
    expect(addMonthsIso('2026-11-30', 3)).toBe('2027-02-28');
    expect(addMonthsIso('2026-01-15', -1)).toBe('2025-12-15');
  });
});

describe('fecha de calendario de un selector de fechas', () => {
  it('ida y vuelta sin desplazarse, en cualquier zona del equipo', () => {
    for (const iso of ['2000-03-15', '2026-09-06', '2026-04-05', '1920-01-01', '2026-12-31']) {
      expect(calendarDateToIso(isoToCalendarDate(iso)!)).toBe(iso);
    }
  });

  it('una medianoche local, como la que entrega un selector, conserva su día', () => {
    expect(calendarDateToIso(new Date(2026, 9, 6, 0, 0, 0))).toBe('2026-10-06');
    expect(calendarDateToIso(new Date(2026, 9, 6, 23, 59, 59))).toBe('2026-10-06');
  });

  it('isoToCalendarDate devuelve null si la fecha está vacía o no es válida', () => {
    expect(isoToCalendarDate('')).toBeNull();
    expect(isoToCalendarDate('no-es-fecha')).toBeNull();
  });
});

describe('formato', () => {
  it('una fecha pura no se desplaza al formatearla', () => {
    expect(
      formatChileDate('2026-10-06', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    ).toBe('06-10-2026');
    expect(
      formatChileDate('1990-01-01', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    ).toBe('01-01-1990');
  });

  it('un instante se formatea con su día de Chile', () => {
    expect(
      formatChileDate('2026-10-07T02:30:00.000Z', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }),
    ).toBe('06-10-2026');
  });

  it('formatChileTime da la hora de pared de Chile en 24 horas', () => {
    expect(formatChileTime('2026-10-07T02:30:00.000Z')).toBe('23:30');
    expect(formatChileTime('2026-10-07T03:05:00.000Z')).toBe('00:05');
    expect(formatChileTime('2026-07-01T12:30:00.000Z')).toBe('08:30');
  });

  it.each([null, undefined, '', 'no-es-fecha'])('%s → "—"', (value) => {
    expect(formatChileDate(value)).toBe('—');
    expect(formatChileTime(value)).toBe('—');
  });
});
