import type { ConfirmSeverity } from '@core/services/ui/confirm-modal.service';

/** Asistencia teórica mínima esperada (Profesional). Solo avisa, nunca bloquea (fix-466-m). */
export const PCT_TEORIA_MINIMA = 75;
/** Asistencia práctica recomendada (Profesional). Solo avisa. */
export const PCT_PRACTICA_RECOMENDADA = 100;

export interface CertificateConfirmationInput {
  nombre: string;
  accion: 'generar' | 'regenerar';
  /** Saldo de la matrícula según la BD. */
  saldoPendiente: number;
  /** Ya existe una habilitación `certificado` (spec 0010-i) para esta matrícula. */
  deudaAutorizada?: boolean;
  /** Clase B: clases prácticas completadas vs requeridas, solo si faltan. */
  practicasIncompletas?: { completadas: number; requeridas: number } | null;
  /** Profesional: `null` = sin registros (p. ej. en el piloto), no se avisa. */
  pctTeoria?: number | null;
  pctPractica?: number | null;
}

export interface CertificateConfirmation {
  title: string;
  message: string;
  severity: ConfirmSeverity;
  confirmLabel: string;
  /** Spec 0010-i (AC8): con deuda sin habilitación previa, el modal exige un motivo. */
  requiresReason: boolean;
}

/** Avisos que no bloquean la emisión pero que quien genera debe ver antes de confirmar. */
export function certificateWarnings(input: CertificateConfirmationInput): string[] {
  const avisos: string[] = [];
  const practicas = input.practicasIncompletas;
  if (practicas && practicas.completadas < practicas.requeridas) {
    avisos.push(
      `Lleva ${practicas.completadas}/${practicas.requeridas} clases prácticas completadas.`,
    );
  }
  if (input.pctTeoria != null && input.pctTeoria < PCT_TEORIA_MINIMA) {
    avisos.push(`Asistencia teórica de ${input.pctTeoria} % (mínimo ${PCT_TEORIA_MINIMA} %).`);
  }
  if (input.pctPractica != null && input.pctPractica < PCT_PRACTICA_RECOMENDADA) {
    avisos.push(
      `Asistencia práctica de ${input.pctPractica} % (recomendado ${PCT_PRACTICA_RECOMENDADA} %).`,
    );
  }
  return avisos;
}

function formatClp(monto: number): string {
  return `$${new Intl.NumberFormat('es-CL').format(monto)}`;
}

/** Texto del modal que precede a toda emisión de certificado (fix-466-m). */
export function buildCertificateConfirmation(
  input: CertificateConfirmationInput,
): CertificateConfirmation {
  const regenerar = input.accion === 'regenerar';
  const parrafos: string[] = [
    regenerar
      ? `¿Regenerar el certificado de ${input.nombre}? Se vuelve a crear el PDF con los datos y la plantilla actuales; se conserva el folio.`
      : `¿Generar el certificado de ${input.nombre}?`,
  ];

  const avisos = certificateWarnings(input);
  if (avisos.length > 0) parrafos.push(avisos.map((a) => `• ${a}`).join('\n'));

  const conDeuda = input.saldoPendiente > 0;
  const requiresReason = conDeuda && !input.deudaAutorizada;
  if (conDeuda) {
    parrafos.push(
      requiresReason
        ? `Tiene un saldo pendiente de ${formatClp(input.saldoPendiente)}. Para emitirlo igual, indica el motivo: quedará registrado quién lo autorizó y por qué, y se avisará a los administradores.`
        : `Tiene un saldo pendiente de ${formatClp(input.saldoPendiente)}; ya se autorizó emitirlo con deuda.`,
    );
  }

  return {
    title: regenerar ? 'Regenerar certificado' : 'Generar certificado',
    message: parrafos.join('\n\n'),
    severity: avisos.length > 0 || conDeuda ? 'warn' : 'info',
    confirmLabel: requiresReason ? 'Emitir igual' : regenerar ? 'Regenerar' : 'Generar',
    requiresReason,
  };
}

/**
 * Resumen de "Generar pendientes" (Clase B y Profesional). Los alumnos con deuda no se emiten en
 * lote (spec 0010-i, AC-E5): se emiten uno a uno, donde el modal pide el motivo.
 */
export function bulkCertificateSummary(
  generados: number,
  conDeuda: number,
  conError: number,
): { ok: boolean; message: string } {
  const plural = generados !== 1 ? 's' : '';
  if (conDeuda === 0 && conError === 0) {
    return {
      ok: true,
      message: `${generados} certificado${plural} generado${plural} correctamente`,
    };
  }
  const partes = [`${generados} generado${plural}`];
  if (conDeuda > 0) partes.push(`${conDeuda} con deuda (emítelos uno a uno)`);
  if (conError > 0) partes.push(`${conError} con error`);
  return { ok: false, message: partes.join(', ') };
}
