import type { ConfirmSeverity } from '@core/services/ui/confirm-modal.service';

/** Asistencia teórica mínima esperada (Profesional). Solo avisa, nunca bloquea (fix-466-m). */
export const PCT_TEORIA_MINIMA = 75;
/** Asistencia práctica recomendada (Profesional). Solo avisa. */
export const PCT_PRACTICA_RECOMENDADA = 100;

export interface CertificateWarningInput {
  nombre: string;
  /** Clase B: clases prácticas completadas vs requeridas. */
  practicasIncompletas?: { completadas: number; requeridas: number } | null;
  /** Profesional: `null` = sin registros (p. ej. en el piloto), no se avisa. */
  pctTeoria?: number | null;
  pctPractica?: number | null;
}

export interface CertificateModal {
  title: string;
  message: string;
  severity: ConfirmSeverity;
  confirmLabel: string;
}

/** Avisos que no bloquean la emisión pero que quien genera debe confirmar. */
export function certificateWarnings(input: CertificateWarningInput): string[] {
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

/**
 * Modal de avisos antes de generar (fix-466-m). `null` = sin avisos: se genera directo, sin modal.
 * La deuda no va acá: la confirma el modal de la spec 0010-i cuando la edge function la rechaza.
 */
export function buildWarningConfirmation(input: CertificateWarningInput): CertificateModal | null {
  const avisos = certificateWarnings(input);
  if (avisos.length === 0) return null;
  return {
    title: 'Generar certificado',
    message: `${input.nombre}:\n${avisos.map((a) => `• ${a}`).join('\n')}\n\n¿Generar el certificado de todos modos?`,
    severity: 'warn',
    confirmLabel: 'Generar de todos modos',
  };
}

/** Modal antes de enviar un certificado por correo (reemplaza la fila inline, fix-466-m). */
export function buildEmailConfirmation(input: {
  nombre: string;
  email: string | null;
  yaEnviado: boolean;
}): CertificateModal {
  const destino = input.email ? ` al correo ${input.email}` : '';
  const reenvio = input.yaEnviado ? '\n\nYa fue enviado anteriormente.' : '';
  return {
    title: 'Enviar certificado',
    message: `Se enviará el certificado de ${input.nombre}${destino}.${reenvio}`,
    severity: 'info',
    confirmLabel: 'Enviar',
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
