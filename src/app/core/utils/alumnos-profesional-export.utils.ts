import type { AlumnoProfesionalTableRow } from '@core/models/ui/alumno-profesional-table-row.model';
import { getSemaforo } from './alumno-profesional-status.utils';
import { formatCLP } from './date.utils';
import type { ExportTable } from './egresados-export.utils';

/**
 * Exportación de la Base de Alumnos Profesional (spec 0023-m). Functional Core.
 *
 * Recibe las filas que la pantalla ya filtró y ordenó (lista normal o Papelera): el archivo trae
 * exactamente lo que se ve, igual que la Base de Alumnos B (fix-281-m).
 */

const SIN_DATO = '—';

function nombreCompleto(a: AlumnoProfesionalTableRow): string {
  return `${a.apellido} ${a.nombre}`.trim();
}

function modulos(a: AlumnoProfesionalTableRow): string {
  return `${a.modulosAprobados}/${a.modulosTotal}`;
}

/** Excel: columnas de la tabla más contacto; el saldo va como número para poder sumarlo. */
export function buildAlumnosProfesionalExcelTable(
  rows: AlumnoProfesionalTableRow[],
): ExportTable<string | number> {
  return {
    headers: [
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
    ],
    rows: rows.map((a) => [
      nombreCompleto(a),
      a.rut,
      a.email || SIN_DATO,
      a.celular || SIN_DATO,
      a.nroMatricula || SIN_DATO,
      a.promocion || SIN_DATO,
      modulos(a),
      getSemaforo(a.semaforo).label,
      a.estado,
      a.saldo,
    ]),
  };
}

/** Ancho relativo de cada columna del PDF, en el orden de `buildAlumnosProfesionalPdfTable().headers`. */
export const ALUMNOS_PROFESIONAL_PDF_COLUMN_WEIGHTS = [3, 1.4, 1.1, 2, 1, 1.2, 1.2, 1.3];

/** PDF: las columnas de la tabla en pantalla, todo como texto. */
export function buildAlumnosProfesionalPdfTable(
  rows: AlumnoProfesionalTableRow[],
): ExportTable<string> {
  return {
    headers: ['Alumno', 'RUT', 'Nº Mat.', 'Promoción', 'Módulos', 'Asistencia', 'Estado', 'Saldo'],
    rows: rows.map((a) => [
      nombreCompleto(a),
      a.rut,
      a.nroMatricula || SIN_DATO,
      a.promocion || SIN_DATO,
      modulos(a),
      getSemaforo(a.semaforo).label,
      a.estado,
      formatCLP(a.saldo),
    ]),
  };
}
