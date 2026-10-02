import { describe, expect, it } from 'vitest';
import type { AlumnoTableRow } from '@core/models/ui/alumno-table-row.model';
import {
  alumnosPdfColumnWeights,
  buildAlumnosExcelTable,
  buildAlumnosPdfTable,
} from './alumnos-export.utils';

function makeAlumno(over: Partial<AlumnoTableRow> = {}): AlumnoTableRow {
  return {
    id: '1',
    nombre: 'Camila Andrea',
    apellido: 'Reyes Muñoz',
    rut: '19.876.543-0',
    email: 'camila@ejemplo.cl',
    celular: '+56 9 9999 8888',
    sucursal: 'Autoescuela Chillán',
    comuna: 'Chillán',
    nroExpedientes: ['0080'],
    fechaIngreso: '22-09-2026',
    status: 'Activo',
    cursos: [{ nombre: 'Clase B', licenseGroup: 'class_b' }],
    pago_por_pagar: 0,
    pago_total: 180000,
    exp_teorico: 'pendiente',
    exp_practico: 'pendiente',
    expediente: { ci: false, foto: true, medico: false, semep: false },
    cursoCompletoPendienteEgreso: false,
    ...over,
  };
}

describe('buildAlumnosExcelTable (fix-281-m)', () => {
  it('trae exactamente las filas que recibe, en el mismo orden', () => {
    const rows = [
      makeAlumno({ id: '2', apellido: 'Zúñiga' }),
      makeAlumno({ id: '1', apellido: 'Abarca' }),
    ];

    const table = buildAlumnosExcelTable(rows);

    expect(table.rows.length).toBe(2);
    expect(table.rows.map((r) => r[0])).toEqual(['Zúñiga Camila Andrea', 'Abarca Camila Andrea']);
  });

  it('arma cada celda como la pantalla: estado, expediente "Parcial · 1/2", fecha dd-mm-aaaa', () => {
    const table = buildAlumnosExcelTable([
      makeAlumno({ status: 'Docs Pendientes', pago_por_pagar: 50000 }),
    ]);

    expect(table.headers).toEqual([
      'Alumno',
      'RUT',
      'Correo',
      'Teléfono',
      'Nº Expediente',
      'Curso',
      'Sede',
      'Fecha de ingreso',
      'Estado',
      'Expediente',
      'Saldo pendiente',
    ]);
    expect(table.rows[0]).toEqual([
      'Reyes Muñoz Camila Andrea',
      '19.876.543-0',
      'camila@ejemplo.cl',
      '+56 9 9999 8888',
      '0080',
      'Clase B',
      'Autoescuela Chillán',
      '22-09-2026',
      'Docs Pendientes',
      'Parcial · 1/2',
      50000,
    ]);
  });

  it('une varias matrículas y cursos, y marca con "—" los datos que faltan', () => {
    const table = buildAlumnosExcelTable([
      makeAlumno({
        celular: '',
        fechaIngreso: '',
        nroExpedientes: ['0080', '0101'],
        cursos: [
          { nombre: 'Clase B', licenseGroup: 'class_b' },
          { nombre: 'Refuerzo Clase B', licenseGroup: 'class_b' },
        ],
      }),
    ]);

    const [row] = table.rows;
    expect(row[3]).toBe('—');
    expect(row[4]).toBe('0080, 0101');
    expect(row[5]).toBe('Clase B, Refuerzo Clase B');
    expect(row[7]).toBe('—');
  });

  it('sin filas devuelve solo la cabecera', () => {
    expect(buildAlumnosExcelTable([]).rows).toEqual([]);
  });
});

describe('buildAlumnosPdfTable (fix-281-m)', () => {
  it('lleva las columnas de la tabla en pantalla, con Sede solo si la pantalla la muestra', () => {
    const conSede = buildAlumnosPdfTable([makeAlumno()], true);
    const sinSede = buildAlumnosPdfTable([makeAlumno()], false);

    expect(conSede.headers).toEqual([
      'Alumno',
      'RUT',
      'Nº Exp.',
      'Curso',
      'Sede',
      'Ingreso',
      'Estado',
      'Expediente',
    ]);
    expect(sinSede.headers).not.toContain('Sede');
    expect(sinSede.rows[0]).toEqual([
      'Reyes Muñoz Camila Andrea',
      '19.876.543-0',
      '0080',
      'Clase B',
      '22-09-2026',
      'Activo',
      'Parcial · 1/2',
    ]);
  });

  it('los anchos de columna calzan con la cantidad de columnas', () => {
    expect(alumnosPdfColumnWeights(true).length).toBe(8);
    expect(alumnosPdfColumnWeights(false).length).toBe(7);
  });
});
