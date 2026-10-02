import { describe, expect, it } from 'vitest';
import type { AlumnoListSort, AlumnoTableRow } from '@core/models/ui/alumno-table-row.model';
import {
  ALUMNO_SORT_OPTIONS,
  nextAlumnoSort,
  sortAlumnos,
  toggleAlumnoSortDirection,
} from './alumnos-sort.utils';

function row(id: string, overrides: Partial<AlumnoTableRow> = {}): AlumnoTableRow {
  return {
    id,
    nombre: 'Ana',
    apellido: 'Pérez Soto',
    rut: '11.111.111-1',
    email: '',
    celular: '',
    sucursal: 'Sede A',
    comuna: '',
    nroExpedientes: ['100'],
    fechaIngreso: '01-01-2026',
    fechaIngresoIso: '2026-01-01T12:00:00Z',
    status: 'Activo',
    cursos: [{ nombre: 'Clase B', licenseGroup: 'class_b' }],
    pago_por_pagar: 0,
    pago_total: 0,
    exp_teorico: 'pendiente',
    exp_practico: 'pendiente',
    expediente: { ci: true, foto: true, medico: false, semep: false },
    cursoCompletoPendienteEgreso: false,
    ...overrides,
  };
}

const ids = (rows: AlumnoTableRow[]): string[] => rows.map((r) => r.id);
const asc = (field: AlumnoListSort['field']): AlumnoListSort => ({ field, direction: 'asc' });
const desc = (field: AlumnoListSort['field']): AlumnoListSort => ({ field, direction: 'desc' });

describe('sortAlumnos', () => {
  it('sin orden elegido devuelve la lista tal como llegó (más recientes primero)', () => {
    const rows = [row('3'), row('2'), row('1')];

    expect(sortAlumnos(rows, null)).toBe(rows);
  });

  it('no modifica la lista original', () => {
    const rows = [row('1', { apellido: 'Zúñiga' }), row('2', { apellido: 'Araya' })];

    sortAlumnos(rows, asc('alumno'));

    expect(ids(rows)).toEqual(['1', '2']);
  });

  describe('Alumno', () => {
    it('ordena por apellido y luego por nombre', () => {
      const rows = [
        row('1', { apellido: 'Reyes Mora', nombre: 'Pedro' }),
        row('2', { apellido: 'Araya Díaz', nombre: 'Luis' }),
        row('3', { apellido: 'Reyes Mora', nombre: 'Ana' }),
      ];

      expect(ids(sortAlumnos(rows, asc('alumno')))).toEqual(['2', '3', '1']);
      expect(ids(sortAlumnos(rows, desc('alumno')))).toEqual(['1', '3', '2']);
    });

    it('ignora tildes y mayúsculas: "Álvarez" no queda al final', () => {
      const rows = [
        row('1', { apellido: 'Zamora' }),
        row('2', { apellido: 'Álvarez' }),
        row('3', { apellido: 'alvarado' }),
      ];

      expect(ids(sortAlumnos(rows, asc('alumno')))).toEqual(['3', '2', '1']);
    });
  });

  it('RUT: ordena por el número, no por el texto', () => {
    const rows = [
      row('1', { rut: '20.111.222-3' }),
      row('2', { rut: '9.876.543-2' }),
      row('3', { rut: '12345678-9' }),
    ];

    expect(ids(sortAlumnos(rows, asc('rut')))).toEqual(['2', '3', '1']);
  });

  it('Nº Exp.: compara como número y usa el primero de la fila', () => {
    const rows = [
      row('1', { nroExpedientes: ['100', '5'] }),
      row('2', { nroExpedientes: ['20'] }),
      row('3', { nroExpedientes: ['3'] }),
    ];

    expect(ids(sortAlumnos(rows, asc('nroExpediente')))).toEqual(['3', '2', '1']);
  });

  it('Curso: usa el nombre del primer curso de la fila', () => {
    const rows = [
      row('1', {
        cursos: [
          { nombre: 'Refuerzo Clase B', licenseGroup: 'class_b' },
          { nombre: 'Clase B', licenseGroup: 'class_b' },
        ],
      }),
      row('2', { cursos: [{ nombre: 'Clase B', licenseGroup: 'class_b' }] }),
    ];

    expect(ids(sortAlumnos(rows, asc('curso')))).toEqual(['2', '1']);
  });

  it('Sede: ordena por el nombre de la sede', () => {
    const rows = [row('1', { sucursal: 'Sede B' }), row('2', { sucursal: 'Sede A' })];

    expect(ids(sortAlumnos(rows, asc('sede')))).toEqual(['2', '1']);
  });

  it('Fecha Ingreso: ordena por la fecha real, no por el texto dd-mm-aaaa', () => {
    const rows = [
      row('1', { fechaIngreso: '05-01-2026', fechaIngresoIso: '2026-01-05T12:00:00Z' }),
      row('2', { fechaIngreso: '20-12-2025', fechaIngresoIso: '2025-12-20T12:00:00Z' }),
      row('3', { fechaIngreso: '10-03-2026', fechaIngresoIso: '2026-03-10T12:00:00Z' }),
    ];

    expect(ids(sortAlumnos(rows, asc('fechaIngreso')))).toEqual(['2', '1', '3']);
    expect(ids(sortAlumnos(rows, desc('fechaIngreso')))).toEqual(['3', '1', '2']);
  });

  it('Estado: ordena alfabéticamente por el texto del estado', () => {
    const rows = [
      row('1', { status: 'Retirado' }),
      row('2', { status: 'Activo' }),
      row('3', { status: 'Docs Pendientes' }),
    ];

    expect(ids(sortAlumnos(rows, asc('estado')))).toEqual(['2', '3', '1']);
  });

  it('Expediente: Pendiente → Parcial → Completo', () => {
    const rows = [
      row('1', { expediente: { ci: true, foto: true, medico: false, semep: false } }),
      row('2', { expediente: { ci: false, foto: false, medico: false, semep: false } }),
      row('3', { expediente: { ci: true, foto: false, medico: false, semep: false } }),
    ];

    expect(ids(sortAlumnos(rows, asc('expediente')))).toEqual(['2', '3', '1']);
    expect(ids(sortAlumnos(rows, desc('expediente')))).toEqual(['1', '3', '2']);
  });

  describe('filas sin dato', () => {
    const rows = [
      row('1', { nroExpedientes: ['—'] }),
      row('2', { nroExpedientes: ['50'] }),
      row('3', { nroExpedientes: [] }),
      row('4', { nroExpedientes: ['7'] }),
    ];

    it('quedan al final en orden ascendente', () => {
      expect(ids(sortAlumnos(rows, asc('nroExpediente')))).toEqual(['4', '2', '1', '3']);
    });

    it('y también en orden descendente', () => {
      expect(ids(sortAlumnos(rows, desc('nroExpediente')))).toEqual(['2', '4', '1', '3']);
    });

    it('una fila sin fecha de ingreso no rompe el orden por fecha', () => {
      const conFecha = row('1', { fechaIngresoIso: '2026-01-05T12:00:00Z' });
      const sinFecha = row('2', { fechaIngresoIso: null });
      const sinCampo = row('3', { fechaIngresoIso: undefined });

      expect(ids(sortAlumnos([sinFecha, sinCampo, conFecha], asc('fechaIngreso')))).toEqual([
        '1',
        '2',
        '3',
      ]);
    });
  });

  it('los empates conservan el orden de llegada, en ambos sentidos', () => {
    const rows = [
      row('3', { status: 'Activo' }),
      row('2', { status: 'Retirado' }),
      row('1', { status: 'Activo' }),
    ];

    expect(ids(sortAlumnos(rows, asc('estado')))).toEqual(['3', '1', '2']);
    expect(ids(sortAlumnos(rows, desc('estado')))).toEqual(['2', '3', '1']);
  });
});

describe('nextAlumnoSort', () => {
  it('primer clic en una columna: ascendente', () => {
    expect(nextAlumnoSort(null, 'rut')).toEqual({ field: 'rut', direction: 'asc' });
  });

  it('segundo clic en la misma columna: descendente', () => {
    expect(nextAlumnoSort(asc('rut'), 'rut')).toEqual({ field: 'rut', direction: 'desc' });
  });

  it('tercer clic en la misma columna: vuelve al orden por defecto', () => {
    expect(nextAlumnoSort(desc('rut'), 'rut')).toBeNull();
  });

  it('clic en otra columna: parte ascendente, sin importar el sentido anterior', () => {
    expect(nextAlumnoSort(desc('rut'), 'estado')).toEqual({ field: 'estado', direction: 'asc' });
  });
});

describe('toggleAlumnoSortDirection', () => {
  it('invierte el sentido conservando la columna', () => {
    expect(toggleAlumnoSortDirection(asc('curso'))).toEqual(desc('curso'));
    expect(toggleAlumnoSortDirection(desc('curso'))).toEqual(asc('curso'));
  });

  it('sin orden elegido no hay nada que invertir', () => {
    expect(toggleAlumnoSortDirection(null)).toBeNull();
  });
});

describe('ALUMNO_SORT_OPTIONS', () => {
  it('ofrece las 8 columnas ordenables, con la etiqueta de la tabla', () => {
    expect(ALUMNO_SORT_OPTIONS.map((o) => o.label)).toEqual([
      'Alumno',
      'RUT',
      'Nº Exp.',
      'Curso',
      'Sede',
      'Fecha Ingreso',
      'Estado',
      'Expediente',
    ]);
  });
});
