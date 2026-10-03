import { describe, expect, it } from 'vitest';
import type { AlumnoProfesionalTableRow } from '@core/models/ui/alumno-profesional-table-row.model';
import { sortAlumnosProfesional } from './alumnos-profesional-sort.utils';

function alumno(
  id: string,
  over: Partial<AlumnoProfesionalTableRow> = {},
): AlumnoProfesionalTableRow {
  return {
    id,
    nombre: 'Ana',
    apellido: 'Pérez',
    rut: '11.111.111-1',
    email: '',
    celular: '',
    nroMatricula: '0100',
    promocion: 'Profesional A4',
    licenseClass: 'A4',
    semaforo: 'green',
    modulosAprobados: 3,
    modulosTotal: 7,
    estado: 'Activo',
    saldo: 0,
    enrollmentId: Number(id),
    ...over,
  };
}

const ids = (rows: AlumnoProfesionalTableRow[]) => rows.map((r) => r.id);

describe('sortAlumnosProfesional (spec 0023-m)', () => {
  it('sin orden devuelve la lista como llega', () => {
    const rows = [alumno('2'), alumno('1')];
    expect(sortAlumnosProfesional(rows, null)).toBe(rows);
  });

  it('ordena por apellido y nombre', () => {
    const rows = [alumno('1', { apellido: 'Zúñiga' }), alumno('2', { apellido: 'Araya' })];
    expect(ids(sortAlumnosProfesional(rows, { field: 'alumno', direction: 'asc' }))).toEqual([
      '2',
      '1',
    ]);
  });

  it('"Asistencia" va de crítico a al día, con los sin datos al final', () => {
    const rows = [
      alumno('1', { semaforo: 'green' }),
      alumno('2', { semaforo: null }),
      alumno('3', { semaforo: 'red' }),
      alumno('4', { semaforo: 'yellow' }),
    ];
    expect(ids(sortAlumnosProfesional(rows, { field: 'asistencia', direction: 'asc' }))).toEqual([
      '3',
      '4',
      '1',
      '2',
    ]);
  });

  it('"Módulos" y "Saldo" se comparan como números', () => {
    const rows = [
      alumno('1', { modulosAprobados: 10, saldo: 5000 }),
      alumno('2', { modulosAprobados: 2, saldo: 120000 }),
    ];
    expect(ids(sortAlumnosProfesional(rows, { field: 'modulos', direction: 'asc' }))).toEqual([
      '2',
      '1',
    ]);
    expect(ids(sortAlumnosProfesional(rows, { field: 'saldo', direction: 'desc' }))).toEqual([
      '2',
      '1',
    ]);
  });

  it('sin promoción ("—") va al final', () => {
    const rows = [alumno('1', { promocion: '—' }), alumno('2', { promocion: 'Profesional A2' })];
    expect(ids(sortAlumnosProfesional(rows, { field: 'promocion', direction: 'desc' }))).toEqual([
      '2',
      '1',
    ]);
  });
});
