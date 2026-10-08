import { describe, expect, it } from 'vitest';
import { isRealtimeEventForStudent } from './realtime-scope.utils';

// fix-360-m — el canal de la ficha escucha tablas completas: sin este filtro, un pago o una
// asistencia de cualquier alumno recargaría la ficha que está abierta.
describe('isRealtimeEventForStudent', () => {
  const scope = { studentId: 10, enrollmentIds: [100, 101] };

  it('acepta una fila de una matrícula del alumno', () => {
    expect(isRealtimeEventForStudent({ new: { enrollment_id: 101 }, old: {} }, scope)).toBe(true);
  });

  it('acepta una fila que apunta al alumno', () => {
    expect(isRealtimeEventForStudent({ new: { student_id: 10 }, old: {} }, scope)).toBe(true);
  });

  it('descarta una fila de otro alumno', () => {
    expect(isRealtimeEventForStudent({ new: { enrollment_id: 999 }, old: {} }, scope)).toBe(false);
    expect(isRealtimeEventForStudent({ new: { student_id: 77 }, old: {} }, scope)).toBe(false);
  });

  it('si la fila trae los dos datos, basta con que uno sea del alumno', () => {
    const payload = { new: { enrollment_id: 999, student_id: 10 }, old: {} };
    expect(isRealtimeEventForStudent(payload, scope)).toBe(true);
  });

  it('un cambio que mueve la fila desde el alumno hacia otro también cuenta', () => {
    const payload = { new: { enrollment_id: 999 }, old: { enrollment_id: 100 } };
    expect(isRealtimeEventForStudent(payload, scope)).toBe(true);
  });

  it('un borrado solo trae la clave: no se puede saber de quién era, se acepta', () => {
    expect(isRealtimeEventForStudent({ new: {}, old: { id: 5 } }, scope)).toBe(true);
    expect(isRealtimeEventForStudent({}, scope)).toBe(true);
  });

  it('sin las matrículas cargadas todavía, una fila con matrícula no se puede descartar', () => {
    const sinMatriculas = { studentId: 10, enrollmentIds: [] };
    expect(isRealtimeEventForStudent({ new: { enrollment_id: 999 } }, sinMatriculas)).toBe(true);
    // Con student_id sí se puede decidir aunque falten las matrículas.
    expect(isRealtimeEventForStudent({ new: { student_id: 77 } }, sinMatriculas)).toBe(false);
  });
});
