/**
 * Convalidación simultánea de licencias profesionales.
 * Pares válidos: A2 (madre) → convalida A4 | A5 (madre) → convalida A3.
 * Un solo registro por matrícula (UNIQUE enrollment_id).
 * El alumno vive en el curso madre; este registro apunta a su único enrollment
 * y al promotion_course del contenido CONV dentro de la misma promoción.
 */
export interface LicenseValidation {
  id: number;
  /** FK al único enrollment del alumno (el del curso madre: A2 o A5). */
  enrollment_id: number;
  /** Licencia convalidada simultáneamente: 'A4' cuando madre es A2, 'A3' cuando madre es A5. */
  convalidated_license: 'A4' | 'A3';
  /** FK al promotion_course del contenido CONV (conv_a4 o conv_a3) en la misma promoción. */
  convalidation_promotion_course_id?: number | null;
  /** Total de horas del curso convalidado en modalidad simultánea (RF-064). */
  reduced_hours: number;
  /** Fecha de apertura del libro del curso convalidado (RF-065). */
  book2_open_date?: string | null;
  /** Referencia a enrollment histórico para trazabilidad de cadena de licencias (RF-066). */
  history_ref_id?: number | null;
  created_at: string;
}
