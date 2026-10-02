import type {
  AlumnoListSort,
  AlumnoSortField,
  AlumnoTableRow,
} from '@core/models/ui/alumno-table-row.model';
import { getExpedienteStatus } from './alumno-status.utils';

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

/** Valor comparable de una fila para una columna. `null` = la fila no tiene ese dato. */
type SortKey = string | number | null;

const EXPEDIENTE_RANK = { Pendiente: 0, Parcial: 1, Completo: 2 } as const;

/** Texto de la celda, o `null` si está vacío o es el guion que la lista usa como "sin dato". */
function textKey(value: string | undefined | null): string | null {
  const text = value?.trim() ?? '';
  return text === '' || text === '—' ? null : text;
}

/** Cuerpo numérico del RUT (lo que va antes del guion), sin puntos. */
function rutKey(rut: string): number | null {
  const digits = rut.split('-')[0].replace(/\D/g, '');
  return digits === '' ? null : Number(digits);
}

function dateKey(iso: string | undefined | null): number | null {
  if (!iso) return null;
  const time = Date.parse(iso);
  return Number.isNaN(time) ? null : time;
}

function sortKey(row: AlumnoTableRow, field: AlumnoSortField): SortKey {
  switch (field) {
    case 'alumno':
      return textKey(`${row.apellido} ${row.nombre}`);
    case 'rut':
      return rutKey(row.rut);
    case 'nroExpediente':
      return textKey(row.nroExpedientes[0]);
    case 'curso':
      return textKey(row.cursos[0]?.nombre);
    case 'sede':
      return textKey(row.sucursal);
    case 'fechaIngreso':
      return dateKey(row.fechaIngresoIso);
    case 'estado':
      return textKey(row.status);
    case 'expediente':
      return EXPEDIENTE_RANK[getExpedienteStatus(row.expediente).label];
  }
}

/** Sin tildes ni mayúsculas, y con los números comparados como números ("20" antes que "100"). */
const collator = new Intl.Collator('es', { sensitivity: 'base', numeric: true });

function compareKeys(a: SortKey, b: SortKey): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return collator.compare(String(a), String(b));
}

/**
 * Ordena la Base de Alumnos por una columna (spec 0020-m). Devuelve una lista nueva.
 *
 * - `sort === null` → la misma lista, sin tocar (orden por defecto: más recientes primero).
 * - Las filas sin dato en la columna van al final en ambos sentidos.
 * - Los empates conservan el orden de llegada.
 */
export function sortAlumnos(rows: AlumnoTableRow[], sort: AlumnoListSort | null): AlumnoTableRow[] {
  if (!sort) return rows;
  const factor = sort.direction === 'asc' ? 1 : -1;

  return rows
    .map((row) => ({ row, key: sortKey(row, sort.field) }))
    .sort((a, b) => {
      if (a.key === null || b.key === null) {
        if (a.key === b.key) return 0;
        return a.key === null ? 1 : -1;
      }
      return factor * compareKeys(a.key, b.key);
    })
    .map((entry) => entry.row);
}

/**
 * Orden que resulta de hacer clic en el título de una columna: ascendente → descendente →
 * orden por defecto. Hacer clic en otra columna siempre parte ascendente.
 */
export function nextAlumnoSort(
  current: AlumnoListSort | null,
  field: AlumnoSortField,
): AlumnoListSort | null {
  if (current?.field !== field) return { field, direction: 'asc' };
  return current.direction === 'asc' ? { field, direction: 'desc' } : null;
}

/** Invierte el sentido del orden vigente. Sin orden elegido no hay nada que invertir. */
export function toggleAlumnoSortDirection(current: AlumnoListSort | null): AlumnoListSort | null {
  if (!current) return null;
  return { field: current.field, direction: current.direction === 'asc' ? 'desc' : 'asc' };
}
