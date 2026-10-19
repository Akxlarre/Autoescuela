import { initialMobileDayIndex } from './agenda-week.utils';

describe('initialMobileDayIndex (hotfix-094-b, P03)', () => {
  const semana = (hoy: number | null) =>
    ['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23'].map((date, i) => ({
      date,
      isToday: i === hoy,
    }));

  it('abre en el día de hoy si está en la semana', () => {
    expect(initialMobileDayIndex(semana(3))).toBe(3);
    expect(initialMobileDayIndex(semana(0))).toBe(0);
  });

  it('otra semana o fin de semana → lunes', () => {
    expect(initialMobileDayIndex(semana(null))).toBe(0);
    expect(initialMobileDayIndex([])).toBe(0);
  });
});
