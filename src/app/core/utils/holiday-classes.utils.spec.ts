import { describe, expect, it } from 'vitest';
import { buildHolidayClassDetails, type HolidayClassRow } from './holiday-classes.utils';

const row = (over: Partial<HolidayClassRow> = {}): HolidayClassRow => ({
  session_id: 1,
  student_id: 50,
  student_name: 'Ana Pérez',
  class_number: 3,
  // 2026-12-08 10:10 hora Chile (verano, UTC-3)
  scheduled_at: '2026-12-08T13:10:00+00:00',
  status: 'scheduled',
  holiday_name: 'Inmaculada Concepción',
  ...over,
});

describe('buildHolidayClassDetails (spec 0056-b, AC6)', () => {
  it('arma alumno, clase, fecha y hora de Chile, y la ruta a la ficha del rol', () => {
    const [d] = buildHolidayClassDetails([row()], 'secretaria');

    expect(d.id).toBe('1');
    expect(d.title).toBe('Ana Pérez');
    expect(d.subtitle).toContain('Clase 3');
    expect(d.subtitle).toContain('8 dic');
    expect(d.subtitle).toContain('10:10');
    expect(d.subtitle).toContain('Inmaculada Concepción');
    expect(d.route).toBe('/app/secretaria/alumnos/50');
  });

  it('admin va a su propia ficha', () => {
    expect(buildHolidayClassDetails([row()], 'admin')[0].route).toBe('/app/admin/alumnos/50');
  });

  it('dice si el cron ya la canceló, para reagendarla desde "Reagendar clases"', () => {
    const [d] = buildHolidayClassDetails([row({ status: 'cancelled' })], 'secretaria');
    expect(d.subtitle).toContain('cancelada');
  });

  it('ordena por fecha', () => {
    const details = buildHolidayClassDetails(
      [
        row({ session_id: 2, scheduled_at: '2026-12-25T13:10:00+00:00' }),
        row({ session_id: 1, scheduled_at: '2026-12-08T13:10:00+00:00' }),
      ],
      'secretaria',
    );
    expect(details.map((d) => d.id)).toEqual(['1', '2']);
  });

  it('sin nombre visible usa un texto genérico', () => {
    expect(buildHolidayClassDetails([row({ student_name: null })], 'secretaria')[0].title).toBe(
      'Alumno',
    );
  });
});
