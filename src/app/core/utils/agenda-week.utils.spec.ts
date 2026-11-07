import {
  agendaShowsLegend,
  formatWeekLabel,
  initialMobileDayIndex,
  studentFichaUrl,
} from './agenda-week.utils';

describe('agendaShowsLegend (fix-241-b, P08)', () => {
  const base = { isLoading: false, error: null, hasWeekData: true, timeRowCount: 13 };

  it('se muestra con datos y también durante la carga', () => {
    expect(agendaShowsLegend(base)).toBe(true);
    expect(agendaShowsLegend({ ...base, isLoading: true, hasWeekData: false })).toBe(true);
  });

  it('no acompaña al error ni a la semana sin horarios', () => {
    expect(agendaShowsLegend({ ...base, error: 'falló' })).toBe(false);
    expect(agendaShowsLegend({ ...base, hasWeekData: false })).toBe(false);
    expect(agendaShowsLegend({ ...base, timeRowCount: 0 })).toBe(false);
  });
});

describe('formatWeekLabel (fix-241-b, P08)', () => {
  it('arma el rango lunes–viernes de la semana', () => {
    expect(formatWeekLabel('2026-11-09')).toBe('9 nov – 13 nov');
  });

  it('cruza de mes', () => {
    expect(formatWeekLabel('2026-11-30')).toBe('30 nov – 4 dic');
  });
});

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
