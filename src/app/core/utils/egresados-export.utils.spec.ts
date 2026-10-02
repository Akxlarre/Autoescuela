import { describe, expect, it } from 'vitest';
import type { EgresadoTableRow } from '@core/models/ui/egresado-table.model';
import { buildEgresadosExcelTable, buildEgresadosPdfTable } from './egresados-export.utils';

function egresado(overrides: Partial<EgresadoTableRow> = {}): EgresadoTableRow {
  return {
    id: 1,
    studentId: '10',
    nombre: 'Reyes Muñoz Camila',
    rut: '19.876.543-0',
    correo: 'camila@ejemplo.cl',
    nroExpediente: '0080',
    licencia: 'Clase B',
    licenseGroup: 'class_b',
    anio: 2026,
    fechaEgreso: '2026-09-22',
    sede: 'Autoescuela Chillán',
    branchId: 1,
    nroCertificado: null,
    saldoPendiente: 0,
    ...overrides,
  };
}

describe('buildEgresadosExcelTable', () => {
  it('trae las columnas de la pantalla más correo y saldo', () => {
    expect(buildEgresadosExcelTable([]).headers).toEqual([
      'Alumno',
      'RUT',
      'Correo',
      'Nº Expediente',
      'Licencia',
      'Fecha de egreso',
      'Sede',
      'Estado de cuenta',
      'Saldo pendiente',
    ]);
  });

  it('una fila por egresado, en el mismo orden en que llegan', () => {
    const table = buildEgresadosExcelTable([
      egresado({ id: 2, nombre: 'Zúñiga Ana' }),
      egresado({ id: 1, nombre: 'Araya Luis' }),
    ]);

    expect(table.rows.map((r) => r[0])).toEqual(['Zúñiga Ana', 'Araya Luis']);
  });

  it('egresado al día: fecha en dd-mm-aaaa, "Al día" y saldo 0 como número', () => {
    expect(buildEgresadosExcelTable([egresado()]).rows[0]).toEqual([
      'Reyes Muñoz Camila',
      '19.876.543-0',
      'camila@ejemplo.cl',
      '0080',
      'Clase B',
      '22-09-2026',
      'Autoescuela Chillán',
      'Al día',
      0,
    ]);
  });

  it('egresado con deuda: "Debe" y el saldo en su propia columna', () => {
    const row = buildEgresadosExcelTable([egresado({ saldoPendiente: 45000 })]).rows[0];

    expect(row[7]).toBe('Debe');
    expect(row[8]).toBe(45000);
  });

  it('sin Nº de expediente ni fecha de egreso: va "—" y no falla', () => {
    const row = buildEgresadosExcelTable([egresado({ nroExpediente: null, fechaEgreso: null })])
      .rows[0];

    expect(row[3]).toBe('—');
    expect(row[5]).toBe('—');
  });
});

describe('buildEgresadosPdfTable', () => {
  it('trae las columnas de la tabla en pantalla', () => {
    expect(buildEgresadosPdfTable([]).headers).toEqual([
      'Alumno',
      'RUT',
      'Nº Exp.',
      'Licencia',
      'Egreso',
      'Sede',
      'Estado de cuenta',
    ]);
  });

  it('todas las celdas son texto; el estado de cuenta incluye el monto si debe', () => {
    const table = buildEgresadosPdfTable([
      egresado(),
      egresado({ id: 2, saldoPendiente: 45000, nroExpediente: null }),
    ]);

    expect(table.rows[0]).toEqual([
      'Reyes Muñoz Camila',
      '19.876.543-0',
      '0080',
      'Clase B',
      '22-09-2026',
      'Autoescuela Chillán',
      'Al día',
    ]);
    expect(table.rows[1][2]).toBe('—');
    expect(table.rows[1][6]).toMatch(/^Debe \$\s?45\.000$/);
  });
});
