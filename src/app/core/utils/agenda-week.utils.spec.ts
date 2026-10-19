import { initialMobileDayIndex, studentFichaUrl } from './agenda-week.utils';

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

describe('studentFichaUrl (hotfix-095-b, E11)', () => {
  it('desde el portal de la secretaria va a su ficha', () => {
    expect(studentFichaUrl('/app/secretaria/agenda', 42, 7)).toBe(
      '/app/secretaria/alumnos/42?enrollment=7',
    );
    expect(studentFichaUrl('/app/secretaria/dashboard', 42, 7)).toBe(
      '/app/secretaria/alumnos/42?enrollment=7',
    );
  });

  it('desde el admin va a la ficha del admin; sin matrícula, sin query', () => {
    expect(studentFichaUrl('/app/admin/agenda', 42, 7)).toBe('/app/admin/alumnos/42?enrollment=7');
    expect(studentFichaUrl('/app/admin/agenda', 42, undefined)).toBe('/app/admin/alumnos/42');
  });
});
