/**
 * Modelos UI para la vista de Ex-Alumnos / Egresados.
 * Derivados de: enrollments + students + users + courses + branches
 */

export interface EgresadoTableRow {
  /** PK del enrollment */
  id: number;
  /** students.id — para navegar al detalle del alumno (misma ficha que Base Alumnos) */
  studentId: string;
  /** Nombre completo para mostrar */
  nombre: string;
  /** RUT formateado */
  rut: string;
  /** users.email */
  correo: string;
  /** enrollments.number */
  nroExpediente: string | null;
  /** Tipo de licencia derivado del código/nombre del curso */
  licencia: string;
  /** Grupo de licencia (enrollments.license_group) — para el split B / Profesional */
  licenseGroup: 'class_b' | 'professional';
  /** Año de egreso derivado de updated_at */
  anio: number | null;
  /** Nombre de la sede */
  sede: string;
  /** branches.id — para precargar la sede al re-matricular (admin) */
  branchId: number | null;
  /** Número de certificado Casa de Moneda — null hasta que se implemente en BD */
  nroCertificado: string | null;
  /** Saldo pendiente de pago */
  saldoPendiente: number;
  /** license_validations.convalidated_license — null si no convalida (fix-195) */
  convalidatedLicense?: 'A4' | 'A3' | null;
}
