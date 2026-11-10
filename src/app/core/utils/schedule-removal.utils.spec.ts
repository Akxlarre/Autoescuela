import { describe, expect, it } from 'vitest';
import {
  SIN_ELIMINACION_MSG,
  reactivateConfirmMessage,
  scheduleRemovalNotices,
} from './schedule-removal.utils';

// 2026-11-17 05:10 en Chile (UTC-3 en verano).
const PRIMERA = '2026-11-17T08:10:00.000Z';
// 23:30 del 17 en Chile, ya 18 en UTC: el día que se muestra debe ser el de Chile.
const NOCHE = '2026-11-18T02:30:00.000Z';

describe('scheduleRemovalNotices — eliminar (AC9)', () => {
  it('varias clases: cantidad y primera fecha', () => {
    const n = scheduleRemovalNotices({
      kind: 'removed',
      count: 3,
      firstAt: PRIMERA,
      alumnoName: 'Ana Pérez',
    });
    expect(n.alumno.subject).toBe('Horario eliminado');
    expect(n.alumno.message).toBe(
      'Se cancelaron tus 3 clases prácticas a partir del 17 de noviembre. Comunícate con la escuela para reagendarlas.',
    );
    expect(n.instructor.subject).toBe('Horario eliminado');
    expect(n.instructor.message).toBe(
      'Se cancelaron 3 clases de Ana Pérez a partir del 17 de noviembre.',
    );
  });

  it('una sola clase: singular con hora', () => {
    const n = scheduleRemovalNotices({
      kind: 'removed',
      count: 1,
      firstAt: PRIMERA,
      alumnoName: 'Ana Pérez',
    });
    expect(n.alumno.message).toBe(
      'Se canceló tu clase práctica del 17 de noviembre a las 05:10. Comunícate con la escuela para reagendarla.',
    );
    expect(n.instructor.message).toBe(
      'Se canceló la clase de Ana Pérez del 17 de noviembre a las 05:10.',
    );
  });
});

describe('scheduleRemovalNotices — reactivar (AC5)', () => {
  it('varias clases: vuelven en su horario original', () => {
    const n = scheduleRemovalNotices({
      kind: 'reactivated',
      count: 2,
      firstAt: PRIMERA,
      alumnoName: 'Ana Pérez',
    });
    expect(n.alumno.subject).toBe('Horario reactivado');
    expect(n.alumno.message).toBe(
      'Tus 2 clases prácticas volvieron a la agenda en su horario original. La primera es el 17 de noviembre a las 05:10.',
    );
    expect(n.instructor.message).toBe(
      'Volvieron a tu agenda 2 clases de Ana Pérez. La primera es el 17 de noviembre a las 05:10.',
    );
  });

  it('una sola clase', () => {
    const n = scheduleRemovalNotices({
      kind: 'reactivated',
      count: 1,
      firstAt: PRIMERA,
      alumnoName: 'Ana Pérez',
    });
    expect(n.alumno.message).toBe(
      'Tu clase práctica del 17 de noviembre a las 05:10 volvió a la agenda.',
    );
    expect(n.instructor.message).toBe(
      'Volvió a tu agenda la clase de Ana Pérez del 17 de noviembre a las 05:10.',
    );
  });

  it('usa el día de Chile, no el de UTC', () => {
    const n = scheduleRemovalNotices({
      kind: 'reactivated',
      count: 1,
      firstAt: NOCHE,
      alumnoName: 'Ana Pérez',
    });
    expect(n.alumno.message).toBe(
      'Tu clase práctica del 17 de noviembre a las 23:30 volvió a la agenda.',
    );
  });
});

describe('reactivateConfirmMessage', () => {
  it('dice cuándo y quién eliminó', () => {
    expect(
      reactivateConfirmMessage({
        count: 2,
        alumnoName: 'Ana Pérez',
        removedAt: PRIMERA,
        removedByName: 'Sofía Rojas',
      }),
    ).toBe(
      'Se volverán a agendar 2 clases futuras de Ana Pérez, que eliminó Sofía Rojas el 17 de noviembre, en su horario original. Las clases de fechas pasadas quedan canceladas.',
    );
  });

  it('una clase y sin nombre de quien eliminó', () => {
    expect(
      reactivateConfirmMessage({
        count: 1,
        alumnoName: 'Ana Pérez',
        removedAt: PRIMERA,
        removedByName: null,
      }),
    ).toBe(
      'Se volverá a agendar 1 clase futura de Ana Pérez, que se eliminó el 17 de noviembre, en su horario original. Las clases de fechas pasadas quedan canceladas.',
    );
  });
});

describe('SIN_ELIMINACION_MSG (AC4)', () => {
  it('orienta a Reagendar Clases', () => {
    expect(SIN_ELIMINACION_MSG).toBe(
      'Estas clases no se cancelaron con "Eliminar horario". Usa "Reagendar Clases" en la ficha del alumno.',
    );
  });
});
