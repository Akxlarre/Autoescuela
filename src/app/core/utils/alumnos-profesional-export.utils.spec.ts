import { describe, expect, it } from 'vitest';
import type { AlumnoProfesionalTableRow } from '@core/models/ui/alumno-profesional-table-row.model';
import {
  ALUMNOS_PROFESIONAL_PDF_COLUMN_WEIGHTS,
  buildAlumnosProfesionalExcelTable,
  buildAlumnosProfesionalPdfTable,
} from './alumnos-profesional-export.utils';

function alumno(over: Partial<AlumnoProfesionalTableRow> = {}): AlumnoProfesionalTableRow {
  return {
    id: '1',
    nombre: 'Juan',
    apellido: 'Soto Rojas',
    rut: '12.345.678-9',
    email: 'juan@ejemplo.cl',
    celular: '+56 9 1111 2222',
    nroMatricula: '0042',
    promocion: 'Profesional A4',
    licenseClass: 'A4',
    semaforo: 'yellow',
    modulosAprobados: 3,
    modulosTotal: 7,
    estado: 'Activo',
    saldo: 150000,
    enrollmentId: 10,
    ...over,
  };
}

describe('buildAlumnosProfesionalExcelTable (spec 0023-m)', () => {
  it('trae las filas que recibe, en su orden, con los valores de la pantalla', () => {
    const table = buildAlumnosProfesionalExcelTable([
      alumno(),
      alumno({ id: '2', apellido: 'Araya', semaforo: null, email: '', celular: '' }),
    ]);

    expect(table.headers).toEqual([
      'Alumno',
      'RUT',
      'Correo',
      'Teléfono',
      'Nº Matrícula',
      'Promoción',
      'Módulos aprobados',
      'Asistencia',
      'Estado',
      'Saldo pendiente',
    ]);
    expect(table.rows[0]).toEqual([
      'Soto Rojas Juan',
      '12.345.678-9',
      'juan@ejemplo.cl',
      '+56 9 1111 2222',
      '0042',
      'Profesional A4',
      '3/7',
      'En riesgo',
      'Activo',
      150000,
    ]);
    expect(table.rows[1][0]).toBe('Araya Juan');
    expect(table.rows[1][2]).toBe('—');
    expect(table.rows[1][7]).toBe('Sin datos');
  });
});

describe('buildAlumnosProfesionalPdfTable (spec 0023-m)', () => {
  it('lleva las columnas de la tabla, con el saldo en pesos', () => {
    const table = buildAlumnosProfesionalPdfTable([alumno({ semaforo: 'red' })]);

    expect(table.headers).toEqual([
      'Alumno',
      'RUT',
      'Nº Mat.',
      'Promoción',
      'Módulos',
      'Asistencia',
      'Estado',
      'Saldo',
    ]);
    expect(table.rows[0][5]).toBe('Crítico');
    expect(table.rows[0][7]).toMatch(/150\.000/);
    expect(ALUMNOS_PROFESIONAL_PDF_COLUMN_WEIGHTS.length).toBe(table.headers.length);
  });
});
