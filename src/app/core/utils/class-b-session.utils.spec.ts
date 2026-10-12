import { describe, expect, it } from 'vitest';
import {
  VALID_CLASS_B_SESSION_STATUSES,
  buildClearScheduleMessage,
  enrollmentsWithConsecutiveAbsences,
  enrollmentsWithRemovedSchedule,
} from './class-b-session.utils';

describe('VALID_CLASS_B_SESSION_STATUSES', () => {
  it('excluye reserved y cancelled', () => {
    expect(VALID_CLASS_B_SESSION_STATUSES).not.toContain('reserved');
    expect(VALID_CLASS_B_SESSION_STATUSES).not.toContain('cancelled');
  });

  it('incluye los estados operativos legítimos', () => {
    expect(VALID_CLASS_B_SESSION_STATUSES).toEqual(
      expect.arrayContaining(['scheduled', 'in_progress', 'completed', 'no_show']),
    );
  });
});

describe('enrollmentsWithConsecutiveAbsences (fix-364-m)', () => {
  it('incluye la matrícula con faltas en dos clases seguidas', () => {
    expect(
      enrollmentsWithConsecutiveAbsences([
        { enrollmentId: 10, classNumber: 3 },
        { enrollmentId: 10, classNumber: 4 },
      ]),
    ).toEqual([10]);
  });

  it('excluye dos faltas que no son seguidas', () => {
    expect(
      enrollmentsWithConsecutiveAbsences([
        { enrollmentId: 10, classNumber: 2 },
        { enrollmentId: 10, classNumber: 7 },
      ]),
    ).toEqual([]);
  });

  it('excluye una sola falta y no mezcla matrículas distintas', () => {
    expect(
      enrollmentsWithConsecutiveAbsences([
        { enrollmentId: 10, classNumber: 3 },
        { enrollmentId: 11, classNumber: 4 },
      ]),
    ).toEqual([]);
  });

  it('ignora faltas sin número de clase y no repite la matrícula', () => {
    expect(
      enrollmentsWithConsecutiveAbsences([
        { enrollmentId: 10, classNumber: null },
        { enrollmentId: 10, classNumber: 5 },
        { enrollmentId: 12, classNumber: 1 },
        { enrollmentId: 12, classNumber: 2 },
        { enrollmentId: 12, classNumber: 3 },
      ]),
    ).toEqual([12]);
  });
});

describe('enrollmentsWithRemovedSchedule (fix-365-m)', () => {
  it('horario eliminado: clases futuras canceladas y ninguna agendada', () => {
    const removed = enrollmentsWithRemovedSchedule([
      { enrollmentId: 10, status: 'cancelled' },
      { enrollmentId: 10, status: 'cancelled' },
    ]);

    expect([...removed]).toEqual([10]);
  });

  it('no lo es si le queda alguna clase futura agendada', () => {
    const removed = enrollmentsWithRemovedSchedule([
      { enrollmentId: 10, status: 'cancelled' },
      { enrollmentId: 10, status: 'scheduled' },
      { enrollmentId: 11, status: 'scheduled' },
    ]);

    expect(removed.size).toBe(0);
  });
});

describe('buildClearScheduleMessage (fix-364-m)', () => {
  it('dice cuántas clases y de qué alumnos', () => {
    const message = buildClearScheduleMessage([
      { alumnoName: 'Juan Pérez', clases: 3 },
      { alumnoName: 'Ana Soto', clases: 1 },
    ]);

    expect(message).toContain('Se cancelarán 4 clases futuras de 2 alumnos');
    expect(message).toContain('Juan Pérez: 3 clases');
    expect(message).toContain('Ana Soto: 1 clase');
    expect(message).not.toContain('Ana Soto: 1 clases');
  });

  it('usa singular con una sola clase de un solo alumno', () => {
    expect(buildClearScheduleMessage([{ alumnoName: 'Juan Pérez', clases: 1 }])).toContain(
      'Se cancelará 1 clase futura de 1 alumno',
    );
  });

  it('resume los alumnos que no caben en la lista', () => {
    const groups = Array.from({ length: 5 }, (_, i) => ({
      alumnoName: `Alumno ${i + 1}`,
      clases: 2,
    }));

    const message = buildClearScheduleMessage(groups, 3);

    expect(message).toContain('Alumno 3: 2 clases');
    expect(message).not.toContain('Alumno 4');
    expect(message).toContain('y 2 alumnos más');
    expect(message).toContain('Se cancelarán 10 clases futuras de 5 alumnos');
  });
});
