/**
 * Modelos UI para la vista de Ex-Alumnos / Egresados.
 * Derivados de: enrollments + students + users + courses + branches
 */

export interface EgresadoTableRow {
  /** PK del enrollment */
  id: number;
  /** Nombre completo para mostrar */
  nombre: string;
  /** RUT formateado */
  rut: string;
  /** Tipo de licencia derivado del código/nombre del curso */
  licencia: string;
  /** Año de egreso derivado de updated_at */
  anio: number | null;
  /** Nombre de la sede */
  sede: string;
  /** Número de certificado Casa de Moneda — null hasta que se implemente en BD */
  nroCertificado: string | null;
  /** Saldo pendiente de pago */
  saldoPendiente: number;
}
