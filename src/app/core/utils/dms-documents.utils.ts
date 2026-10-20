import type { DmsStudentDocSource } from '@core/models/ui/dms.model';

/**
 * ¿Se puede eliminar este documento del alumno desde el DMS? (fix-470-m)
 *
 * Las filas `enrollment_license` (carnets) y `enrollment_file` (contrato firmado, certificados) se
 * derivan de columnas de la matrícula: no tienen registro propio que borrar y se gestionan en la
 * ficha del alumno o en Certificación. El contrato (`digital_contract`) tampoco se borra desde el
 * DMS (fix-475-m, decisión F04): si está mal, se reemplaza desde la ficha.
 */
export function isDeletableStudentDoc(source: DmsStudentDocSource): boolean {
  return source === 'student_document';
}
