import type { ElegibilidadCertProf } from '@core/models/ui/certificacion-profesional.model';

/**
 * ¿Puede emitirse el certificado Profesional de este alumno?
 *
 * - Admin: siempre (sin chequeo de asistencia ni pago).
 * - Secretaria: pago completo y, si se exigen datos académicos, teoría ≥ 75 %.
 * - fix-465-m: mientras el piloto recorte Profesional la asistencia se lleva a mano en el libro de
 *   clases, así que `academicRequired` es `false` y solo cuenta el pago.
 *
 * Nota y práctica nunca bloquean (informativa y confirmación inline, respectivamente).
 */
export function isEligibleForProfessionalCertificate(
  isAdmin: boolean,
  elegibilidad: ElegibilidadCertProf,
  academicRequired: boolean,
): boolean {
  if (isAdmin) return true;
  if (!elegibilidad.pago) return false;
  return academicRequired ? elegibilidad.teoria : true;
}
