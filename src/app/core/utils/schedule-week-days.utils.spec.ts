import { describe, expect, it } from 'vitest';
import { filterVisibleWeekDays } from './schedule-week-days.utils';
import type { ScheduleDay } from '@core/models/ui/instructor-portal.model';

describe('filterVisibleWeekDays', () => {
  const weekDays: ScheduleDay[] = [
    { name: 'Lunes', date: '2026-08-10', dayNumber: 10, isToday: false },
    { name: 'Martes', date: '2026-08-11', dayNumber: 11, isToday: false },
    { name: 'Miércoles', date: '2026-08-12', dayNumber: 12, isToday: false },
    { name: 'Jueves', date: '2026-08-13', dayNumber: 13, isToday: false },
    { name: 'Viernes', date: '2026-08-14', dayNumber: 14, isToday: true },
    { name: 'Sábado', date: '2026-08-15', dayNumber: 15, isToday: false },
    { name: 'Domingo', date: '2026-08-16', dayNumber: 16, isToday: false },
  ];

  it('excludes Domingo — never has classes', () => {
    const result = filterVisibleWeekDays(weekDays);

    expect(result).toHaveLength(6);
    expect(result.some((d) => d.name === 'Domingo')).toBe(false);
  });

  it('preserves the original Mon-Sat order (index i corresponds to dayOfWeek i)', () => {
    const result = filterVisibleWeekDays(weekDays);

    expect(result.map((d) => d.name)).toEqual([
      'Lunes',
      'Martes',
      'Miércoles',
      'Jueves',
      'Viernes',
      'Sábado',
    ]);
  });

  it('returns an empty array when weekDays is undefined', () => {
    expect(filterVisibleWeekDays(undefined)).toEqual([]);
  });
});
