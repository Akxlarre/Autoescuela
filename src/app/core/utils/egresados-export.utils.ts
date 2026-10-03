import type { EgresadoTableRow } from '@core/models/ui/egresado-table.model';
import { formatCLP, formatDayMonthYear } from './date.utils';

/** Tabla lista para exportar: una cabecera y una fila de celdas por registro. */
export interface ExportTable<TCell> {
  headers: string[];
  rows: TCell[][];
}

const SIN_DATO = '—';

/**
 * Lista de Ex-Alumnos para Excel (spec 0021-m). Recibe las filas que la pantalla ya filtró, en
 * su orden: el archivo trae lo que se ve. El saldo va como número para poder sumarlo.
 */
export function buildEgresadosExcelTable(
  rows: EgresadoTableRow[],
  /** Título de la columna del número: "Nº Expediente" (Clase B) o "Nº Matrícula" (Profesional, spec 0023-m). */
  nroLabel = 'Nº Expediente',
): ExportTable<string | number> {
  return {
    headers: [
      'Alumno',
      'RUT',
      'Correo',
      nroLabel,
      'Licencia',
      'Fecha de egreso',
      'Sede',
      'Estado de cuenta',
      'Saldo pendiente',
    ],
    rows: rows.map((e) => [
      e.nombre,
      e.rut,
      e.correo,
      e.nroExpediente ?? SIN_DATO,
      e.licencia,
      formatDayMonthYear(e.fechaEgreso),
      e.sede,
      e.saldoPendiente > 0 ? 'Debe' : 'Al día',
      e.saldoPendiente,
    ]),
  };
}

/** Ancho relativo de cada columna del PDF, en el orden de `buildEgresadosPdfTable().headers`. */
export const EGRESADOS_PDF_COLUMN_WEIGHTS = [3.2, 1.5, 1.2, 1.2, 1.3, 2.4, 1.8];

/** Lista de Ex-Alumnos para PDF: las columnas de la tabla en pantalla, todo como texto. */
export function buildEgresadosPdfTable(
  rows: EgresadoTableRow[],
  /** "Nº Exp." (Clase B) o "Nº Mat." (Profesional, spec 0023-m). */
  nroLabel = 'Nº Exp.',
): ExportTable<string> {
  return {
    headers: ['Alumno', 'RUT', nroLabel, 'Licencia', 'Egreso', 'Sede', 'Estado de cuenta'],
    rows: rows.map((e) => [
      e.nombre,
      e.rut,
      e.nroExpediente ?? SIN_DATO,
      e.licencia,
      formatDayMonthYear(e.fechaEgreso),
      e.sede,
      e.saldoPendiente > 0 ? `Debe ${formatCLP(e.saldoPendiente)}` : 'Al día',
    ]),
  };
}
