import {
  agendaShowsLegend,
  formatWeekLabel,
  initialMobileDayIndex,
  studentFichaUrl,
  fleetUrl,
  agendaSlotAriaLabel,
  agendaSlotIdentity,
} from './agenda-week.utils';

// fix-251-b: el aviso del vehículo existía solo para quien pasaba el mouse, y los libres de la
// vista "Todos" no decían de qué instructor ni vehículo eran.
describe('agendaSlotAriaLabel (fix-251-b)', () => {
  const libre = { status: 'available', startTime: '08:30', instructorName: 'Juan Pérez' };

  it('incluye el aviso del vehículo cuando lo hay', () => {
    expect(agendaSlotAriaLabel(libre, false, 'Vehículo RTRE29: SOAP vencido')).toBe(
      'Slot disponible 08:30 — Juan Pérez. Vehículo RTRE29: SOAP vencido. Clic para ver detalle.',
    );
  });

  it('sin aviso, el texto de siempre', () => {
    expect(agendaSlotAriaLabel(libre, false, '')).toBe(
      'Slot disponible 08:30 — Juan Pérez. Clic para ver detalle.',
    );
    expect(
      agendaSlotAriaLabel({ ...libre, status: 'scheduled', studentName: 'Ana Soto' }, false, ''),
    ).toBe('Ana Soto, 08:30 — Juan Pérez. Clic para ver detalle.');
  });

  it('fuera del rango configurado manda el bloqueo', () => {
    expect(agendaSlotAriaLabel(libre, true, 'Vehículo RTRE29: SOAP vencido')).toBe(
      '08:30 — fuera del rango de visualización configurado.',
    );
  });
});

describe('agendaSlotIdentity (fix-251-b)', () => {
  it('primer nombre del instructor y patente', () => {
    expect(agendaSlotIdentity('Juan Pérez', 'RTRE29')).toBe('Juan · RTRE29');
  });

  it('sin patente, solo el nombre', () => {
    expect(agendaSlotIdentity('  Juan  Pérez ', '')).toBe('Juan');
  });
});

describe('fleetUrl (fix-251-b)', () => {
  it('lleva a la Flota del portal actual', () => {
    expect(fleetUrl('/app/secretaria/agenda')).toBe('/app/secretaria/flota');
    expect(fleetUrl('/app/secretaria/dashboard')).toBe('/app/secretaria/flota');
    expect(fleetUrl('/app/admin/agenda')).toBe('/app/admin/flota');
  });
});

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
