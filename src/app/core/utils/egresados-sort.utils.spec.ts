import { describe, expect, it } from 'vitest';
import type { EgresadoTableRow } from '@core/models/ui/egresado-table.model';
import { egresadoSortOptions, sortEgresados } from './egresados-sort.utils';

function egresado(id: number, over: Partial<EgresadoTableRow> = {}): EgresadoTableRow {
  return {
    id,
    studentId: String(id),
    nombre: 'Pérez Ana',
    rut: '11.111.111-1',
    correo: '',
    nroExpediente: '0100',
    licencia: 'Clase B',
    licenseGroup: 'class_b',
    anio: 2026,
    fechaEgreso: '2026-03-01',
    sede: 'Sede A',
    branchId: 1,
    nroCertificado: null,
    saldoPendiente: 0,
    ...over,
  };
}

const ids = (rows: EgresadoTableRow[]) => rows.map((r) => r.id);

describe('sortEgresados (spec 0023-m)', () => {
  it('sin orden devuelve la lista como llega', () => {
    const rows = [egresado(2), egresado(1)];
    expect(sortEgresados(rows, null)).toBe(rows);
  });

  it('ordena por nombre sin distinguir tildes', () => {
    const rows = [egresado(1, { nombre: 'Zúñiga' }), egresado(2, { nombre: 'Álvarez' })];
    expect(ids(sortEgresados(rows, { field: 'alumno', direction: 'asc' }))).toEqual([2, 1]);
  });

  it('"Año / Sede" ordena por fecha de egreso, con las filas sin fecha al final', () => {
    const rows = [
      egresado(1, { fechaEgreso: '2026-05-01' }),
      egresado(2, { fechaEgreso: null }),
      egresado(3, { fechaEgreso: '2025-12-01' }),
    ];
    expect(ids(sortEgresados(rows, { field: 'egreso', direction: 'asc' }))).toEqual([3, 1, 2]);
    expect(ids(sortEgresados(rows, { field: 'egreso', direction: 'desc' }))).toEqual([1, 3, 2]);
  });

  it('"Estado cuenta" ordena por saldo pendiente', () => {
    const rows = [
      egresado(1, { saldoPendiente: 50000 }),
      egresado(2, { saldoPendiente: 0 }),
      egresado(3, { saldoPendiente: 10000 }),
    ];
    expect(ids(sortEgresados(rows, { field: 'estadoCuenta', direction: 'desc' }))).toEqual([
      1, 3, 2,
    ]);
  });

  it('el Nº sin asignar va al final', () => {
    const rows = [egresado(1, { nroExpediente: null }), egresado(2, { nroExpediente: '0005' })];
    expect(ids(sortEgresados(rows, { field: 'nroExpediente', direction: 'asc' }))).toEqual([2, 1]);
  });
});

describe('egresadoSortOptions', () => {
  it('usa el título de la tercera columna que recibe', () => {
    expect(egresadoSortOptions('Nº Mat.')[2]).toEqual({ label: 'Nº Mat.', value: 'nroExpediente' });
    expect(egresadoSortOptions('Nº Exp.').map((o) => o.label)).toEqual([
      'Alumno',
      'RUT',
      'Nº Exp.',
      'Licencia',
      'Año / Sede',
      'Estado cuenta',
    ]);
  });
});
