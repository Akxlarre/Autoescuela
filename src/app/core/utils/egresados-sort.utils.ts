import type { EgresadoTableRow } from '@core/models/ui/egresado-table.model';
import {
  dateSortKey,
  rutSortKey,
  sortRows,
  textSortKey,
  type SortKey,
  type TableSort,
} from './table-sort.utils';

/** Columnas ordenables de Ex-Alumnos (Clase B y Profesional comparten la tabla, spec 0023-m). */
export type EgresadoSortField =
  | 'alumno'
  | 'rut'
  | 'nroExpediente'
  | 'licencia'
  | 'egreso'
  | 'estadoCuenta';

export type EgresadoListSort = TableSort<EgresadoSortField>;

/**
 * Columnas ordenables, en el orden de la tabla. `nroLabel` es el título de la tercera columna:
 * "Nº Exp." en Clase B y "Nº Mat." en Profesional.
 */
export function egresadoSortOptions(
  nroLabel: string,
): { label: string; value: EgresadoSortField }[] {
  return [
    { label: 'Alumno', value: 'alumno' },
    { label: 'RUT', value: 'rut' },
    { label: nroLabel, value: 'nroExpediente' },
    { label: 'Licencia', value: 'licencia' },
    // "Año / Sede" ordena por la fecha de egreso (el año es lo que se lee primero).
    { label: 'Año / Sede', value: 'egreso' },
    // "Estado cuenta" ordena por saldo pendiente: al día (0) primero en ascendente.
    { label: 'Estado cuenta', value: 'estadoCuenta' },
  ];
}

function sortKey(row: EgresadoTableRow, field: EgresadoSortField): SortKey {
  switch (field) {
    case 'alumno':
      return textSortKey(row.nombre);
    case 'rut':
      return rutSortKey(row.rut);
    case 'nroExpediente':
      return textSortKey(row.nroExpediente);
    case 'licencia':
      return textSortKey(row.licencia);
    case 'egreso':
      return dateSortKey(row.fechaEgreso);
    case 'estadoCuenta':
      return row.saldoPendiente;
  }
}

/** Ordena Ex-Alumnos por una columna (spec 0023-m). Sin orden devuelve la misma lista. */
export function sortEgresados(
  rows: EgresadoTableRow[],
  sort: EgresadoListSort | null,
): EgresadoTableRow[] {
  return sortRows(rows, sort, sortKey);
}
