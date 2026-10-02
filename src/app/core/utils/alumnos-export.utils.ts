import type { AlumnoTableRow } from '@core/models/ui/alumno-table-row.model';
import { getExpedienteStatus } from './alumno-status.utils';
import type { ExportTable } from './egresados-export.utils';

/**
 * Exportación de la Base de Alumnos B (fix-281-m). Functional Core.
 *
 * Recibe las filas que la pantalla ya filtró y ordenó (lista normal o Papelera): el archivo trae
 * exactamente lo que se ve. Antes la Edge Function `export-students` volvía a consultar y a
 * filtrar por su cuenta, y sus reglas se habían desalineado de la pantalla (B1 de ASG-i-024).
 */

const SIN_DATO = '—';

function nombreCompleto(a: AlumnoTableRow): string {
  return `${a.apellido} ${a.nombre}`.trim();
}

function unir(valores: string[]): string {
  return valores.length > 0 ? valores.join(', ') : SIN_DATO;
}

/** Igual que la etiqueta de la columna Expediente en pantalla, p. ej. "Parcial · 1/2". */
function expedienteLabel(a: AlumnoTableRow): string {
  const exp = getExpedienteStatus(a.expediente);
  return `${exp.label} · ${exp.count}`;
}

/** Excel: todas las columnas útiles; el saldo va como número para poder sumarlo. */
export function buildAlumnosExcelTable(rows: AlumnoTableRow[]): ExportTable<string | number> {
  return {
    headers: [
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
    ],
    rows: rows.map((a) => [
      nombreCompleto(a),
      a.rut,
      a.email || SIN_DATO,
      a.celular || SIN_DATO,
      unir(a.nroExpedientes),
      unir(a.cursos.map((c) => c.nombre)),
      a.sucursal || SIN_DATO,
      a.fechaIngreso || SIN_DATO,
      a.status,
      expedienteLabel(a),
      a.pago_por_pagar,
    ]),
  };
}

/**
 * Anchos relativos de las columnas del PDF, en el orden de `buildAlumnosPdfTable().headers`.
 * La columna Sede solo existe cuando la pantalla la muestra (admin viendo todas las sedes).
 */
export function alumnosPdfColumnWeights(showSede: boolean): number[] {
  return showSede ? [3, 1.5, 1.1, 1.6, 1.8, 1.1, 1.4, 1.3] : [3.2, 1.5, 1.1, 1.8, 1.1, 1.4, 1.3];
}

/** PDF: las columnas de la tabla en pantalla, todo como texto. */
export function buildAlumnosPdfTable(
  rows: AlumnoTableRow[],
  showSede: boolean,
): ExportTable<string> {
  return {
    headers: [
      'Alumno',
      'RUT',
      'Nº Exp.',
      'Curso',
      ...(showSede ? ['Sede'] : []),
      'Ingreso',
      'Estado',
      'Expediente',
    ],
    rows: rows.map((a) => [
      nombreCompleto(a),
      a.rut,
      unir(a.nroExpedientes),
      unir(a.cursos.map((c) => c.nombre)),
      ...(showSede ? [a.sucursal || SIN_DATO] : []),
      a.fechaIngreso || SIN_DATO,
      a.status,
      expedienteLabel(a),
    ]),
  };
}
