import {
  findReactivationConflicts,
  reactivationConflictMessage,
  type SesionAgendable,
} from './reactivation-conflicts.utils';

// fix-245-b (N03): qué clase choca al reactivar un horario.

const clase = (over: Partial<SesionAgendable>): SesionAgendable => ({
  id: 1,
  classNumber: 3,
  // 13:30 UTC = 10:30 hora Chile (verano, UTC−3)
  scheduledAt: '2026-11-10T13:30:00.000Z',
  durationMin: 45,
  instructorId: 9,
  vehicleId: 4,
  enrollmentId: 100,
  ...over,
});

describe('findReactivationConflicts', () => {
  it('detecta el choque con otra clase del mismo instructor a la misma hora', () => {
    const candidata = clase({ id: 1 });
    const otra = clase({ id: 50, enrollmentId: 200, vehicleId: 8 });

    const conflictos = findReactivationConflicts([candidata], [otra]);

    expect(conflictos).toEqual([{ clase: candidata, motivo: 'instructor' }]);
  });

  it('detecta el choque por vehículo cuando el instructor es otro', () => {
    const candidata = clase({ id: 1 });
    const otra = clase({ id: 50, enrollmentId: 200, instructorId: 77 });

    expect(findReactivationConflicts([candidata], [otra])[0].motivo).toBe('vehiculo');
  });

  it('detecta el choque con otra clase activa del mismo alumno', () => {
    const candidata = clase({ id: 1 });
    const otra = clase({ id: 50, instructorId: 77, vehicleId: 8 });

    expect(findReactivationConflicts([candidata], [otra])[0].motivo).toBe('alumno');
  });

  it('un solape parcial también choca (misma regla que los triggers)', () => {
    const candidata = clase({ id: 1 });
    const otra = clase({ id: 50, enrollmentId: 200, scheduledAt: '2026-11-10T14:00:00.000Z' });

    expect(findReactivationConflicts([candidata], [otra])).toHaveLength(1);
  });

  it('bloques que solo se tocan no chocan', () => {
    const candidata = clase({ id: 1 });
    // empieza justo cuando termina la candidata (13:30 + 45 min)
    const otra = clase({ id: 50, enrollmentId: 200, scheduledAt: '2026-11-10T14:15:00.000Z' });

    expect(findReactivationConflicts([candidata], [otra])).toEqual([]);
  });

  it('usa 45 minutos si duration_min viene null', () => {
    const candidata = clase({ id: 1, durationMin: null });
    const otra = clase({ id: 50, enrollmentId: 200, scheduledAt: '2026-11-10T14:10:00.000Z' });

    expect(findReactivationConflicts([candidata], [otra])).toHaveLength(1);
  });

  it('ignora a las propias candidatas (se reactivan juntas)', () => {
    const a = clase({ id: 1 });
    const b = clase({ id: 2, classNumber: 4 });

    expect(findReactivationConflicts([a, b], [a, b])).toEqual([]);
  });

  it('ignora filas sin fecha', () => {
    const candidata = clase({ id: 1 });
    const otra = clase({ id: 50, enrollmentId: 200, scheduledAt: null });

    expect(findReactivationConflicts([candidata], [otra])).toEqual([]);
  });

  it('ordena los choques por fecha', () => {
    const tarde = clase({ id: 2, classNumber: 4, scheduledAt: '2026-11-11T13:30:00.000Z' });
    const temprano = clase({ id: 1, classNumber: 3 });
    const ocupadas = [
      clase({ id: 60, enrollmentId: 200, scheduledAt: tarde.scheduledAt }),
      clase({ id: 50, enrollmentId: 200 }),
    ];

    const numeros = findReactivationConflicts([tarde, temprano], ocupadas).map(
      (c) => c.clase.classNumber,
    );
    expect(numeros).toEqual([3, 4]);
  });
});

describe('reactivationConflictMessage', () => {
  it('nombra la clase, el día, la hora en Chile y el motivo', () => {
    const mensaje = reactivationConflictMessage([{ clase: clase({}), motivo: 'instructor' }]);

    expect(mensaje).toContain('Clase 3');
    expect(mensaje).toContain('10:30');
    expect(mensaje).toContain('10');
    expect(mensaje).toContain('el instructor ya tiene otra clase');
    expect(mensaje).toContain('No se reactivó ninguna');
    expect(mensaje).toContain('Reagendar Clases');
  });

  it('lista varias clases', () => {
    const mensaje = reactivationConflictMessage([
      { clase: clase({}), motivo: 'instructor' },
      {
        clase: clase({ id: 2, classNumber: 4, scheduledAt: '2026-11-11T13:30:00.000Z' }),
        motivo: 'vehiculo',
      },
    ]);

    expect(mensaje).toContain('Clase 3');
    expect(mensaje).toContain('Clase 4');
    expect(mensaje).toContain('el vehículo ya tiene otra clase');
  });
});
