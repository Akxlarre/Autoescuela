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
  /**
   * Fecha de egreso completa (ISO `YYYY-MM-DD`), derivada de `updated_at`.
   *
   * Existe además de `anio` porque la ventana de período (fix-147-b) necesita precisión de día:
   * con solo el año, alguien que egresó en diciembre quedaba fuera de la ventana de 12 meses
   * por hasta 11 meses de error.
   */
  fechaEgreso: string | null;
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
