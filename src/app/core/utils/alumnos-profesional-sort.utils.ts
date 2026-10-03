import type {
  AlumnoProfesionalTableRow,
  SemaforoAsistencia,
} from '@core/models/ui/alumno-profesional-table-row.model';
import { sortRows, textSortKey, type SortKey, type TableSort } from './table-sort.utils';

/** Columnas ordenables de la Base de Alumnos Profesional (spec 0023-m). */
export type AlumnoProfesionalSortField =
  | 'alumno'
  | 'nroMatricula'
  | 'promocion'
  | 'modulos'
  | 'asistencia'
  | 'estado'
  | 'saldo';

export type AlumnoProfesionalListSort = TableSort<AlumnoProfesionalSortField>;

/** Columnas ordenables, en el orden de la tabla. */
export const ALUMNO_PROFESIONAL_SORT_OPTIONS: readonly {
  label: string;
  value: AlumnoProfesionalSortField;
}[] = [
  { label: 'Alumno', value: 'alumno' },
  { label: 'Nº Mat.', value: 'nroMatricula' },
  { label: 'Promoción', value: 'promocion' },
  { label: 'Módulos', value: 'modulos' },
  { label: 'Asistencia', value: 'asistencia' },
  { label: 'Estado', value: 'estado' },
  { label: 'Saldo', value: 'saldo' },
];

/** Ascendente = los que más atención necesitan primero: crítico → en riesgo → al día. */
const SEMAFORO_RANK: Record<SemaforoAsistencia, number> = { red: 0, yellow: 1, green: 2 };

function sortKey(row: AlumnoProfesionalTableRow, field: AlumnoProfesionalSortField): SortKey {
  switch (field) {
    case 'alumno':
      return textSortKey(`${row.apellido} ${row.nombre}`);
    case 'nroMatricula':
      return textSortKey(row.nroMatricula);
    case 'promocion':
      return textSortKey(row.promocion);
    case 'modulos':
      return row.modulosAprobados;
    case 'asistencia':
      return row.semaforo ? SEMAFORO_RANK[row.semaforo] : null;
    case 'estado':
      return textSortKey(row.estado);
    case 'saldo':
      return row.saldo;
  }
}

/** Ordena la Base de Alumnos Profesional por una columna. Sin orden devuelve la misma lista. */
export function sortAlumnosProfesional(
  rows: AlumnoProfesionalTableRow[],
  sort: AlumnoProfesionalListSort | null,
): AlumnoProfesionalTableRow[] {
  return sortRows(rows, sort, sortKey);
}
