import type {
  AlumnoListSort,
  AlumnoSortField,
  AlumnoTableRow,
} from '@core/models/ui/alumno-table-row.model';
import { getExpedienteStatus } from './alumno-status.utils';
import {
  dateSortKey,
  nextSort,
  rutSortKey,
  sortRows,
  textSortKey,
  toggleSortDirection,
  type SortKey,
} from './table-sort.utils';

/** Columnas ordenables de la Base de Alumnos, con la etiqueta que muestra la tabla. */
export const ALUMNO_SORT_OPTIONS: readonly { label: string; value: AlumnoSortField }[] = [
  { label: 'Alumno', value: 'alumno' },
  { label: 'RUT', value: 'rut' },
  { label: 'Nº Exp.', value: 'nroExpediente' },
  { label: 'Curso', value: 'curso' },
  { label: 'Sede', value: 'sede' },
  { label: 'Fecha Ingreso', value: 'fechaIngreso' },
  { label: 'Estado', value: 'estado' },
  { label: 'Expediente', value: 'expediente' },
];

const EXPEDIENTE_RANK = { Pendiente: 0, Parcial: 1, Completo: 2 } as const;

function sortKey(row: AlumnoTableRow, field: AlumnoSortField): SortKey {
  switch (field) {
    case 'alumno':
      return textSortKey(`${row.apellido} ${row.nombre}`);
    case 'rut':
      return rutSortKey(row.rut);
    case 'nroExpediente':
      return textSortKey(row.nroExpedientes[0]);
    case 'curso':
      return textSortKey(row.cursos[0]?.nombre);
    case 'sede':
      return textSortKey(row.sucursal);
    case 'fechaIngreso':
      return dateSortKey(row.fechaIngresoIso);
    case 'estado':
      return textSortKey(row.status);
    case 'expediente':
      return EXPEDIENTE_RANK[getExpedienteStatus(row.expediente).label];
  }
}

/**
 * Ordena la Base de Alumnos por una columna (spec 0020-m). Devuelve una lista nueva.
 *
 * - `sort === null` → la misma lista, sin tocar (orden por defecto: más recientes primero).
 * - Las filas sin dato en la columna van al final en ambos sentidos.
 * - Los empates conservan el orden de llegada.
 *
 * La mecánica de orden es la compartida de `table-sort.utils` (spec 0023-m).
 */
export function sortAlumnos(rows: AlumnoTableRow[], sort: AlumnoListSort | null): AlumnoTableRow[] {
  return sortRows(rows, sort, sortKey);
}

/**
 * Orden que resulta de hacer clic en el título de una columna: ascendente → descendente →
 * orden por defecto. Hacer clic en otra columna siempre parte ascendente.
 */
export function nextAlumnoSort(
  current: AlumnoListSort | null,
  field: AlumnoSortField,
): AlumnoListSort | null {
  return nextSort(current, field);
}

/** Invierte el sentido del orden vigente. Sin orden elegido no hay nada que invertir. */
export function toggleAlumnoSortDirection(current: AlumnoListSort | null): AlumnoListSort | null {
  return toggleSortDirection(current);
}
